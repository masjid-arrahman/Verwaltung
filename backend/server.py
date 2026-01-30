from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Member(BaseModel):
    member_id: str = Field(default_factory=lambda: f"member_{uuid.uuid4().hex[:12]}")
    vorname: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemberCreate(BaseModel):
    vorname: str
    name: str


class MemberUpdate(BaseModel):
    vorname: Optional[str] = None
    name: Optional[str] = None


class Payment(BaseModel):
    payment_id: str = Field(default_factory=lambda: f"payment_{uuid.uuid4().hex[:12]}")
    member_id: str
    year: int
    month: int  # 1-12
    paid: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentUpdate(BaseModel):
    paid: bool


class PublicMemberStatus(BaseModel):
    vorname: str
    name: str
    payments: List[dict]  # [{month: 1, paid: True}, ...]


# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session in database
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Emergent Auth for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    
    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    
    auth_data = auth_response.json()
    
    # Create or update user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"email": auth_data["email"]},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data.get("picture")
            }}
        )
    else:
        await db.users.insert_one({
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Create session
    session_token = auth_data.get("session_token", f"session_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Delete old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    
    # Create new session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    # Get user for response
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return user_doc


@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}


# ==================== MEMBER ROUTES (Protected) ====================

@api_router.get("/members", response_model=List[dict])
async def get_members(user: User = Depends(get_current_user)):
    """Get all members"""
    members = await db.members.find({}, {"_id": 0}).to_list(1000)
    return members


@api_router.post("/members", response_model=dict)
async def create_member(member: MemberCreate, user: User = Depends(get_current_user)):
    """Create a new member"""
    member_obj = Member(vorname=member.vorname, name=member.name)
    doc = member_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.members.insert_one(doc)
    
    # Exclude _id from response
    doc.pop("_id", None)
    return doc


@api_router.get("/members/{member_id}", response_model=dict)
async def get_member(member_id: str, user: User = Depends(get_current_user)):
    """Get a single member"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@api_router.put("/members/{member_id}", response_model=dict)
async def update_member(member_id: str, update: MemberUpdate, user: User = Depends(get_current_user)):
    """Update a member"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.members.update_one({"member_id": member_id}, {"$set": update_data})
    
    updated_member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    return updated_member


@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, user: User = Depends(get_current_user)):
    """Delete a member and their payments"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    await db.members.delete_one({"member_id": member_id})
    await db.payments.delete_many({"member_id": member_id})
    
    return {"message": "Member deleted successfully"}


# ==================== PAYMENT ROUTES (Protected) ====================

@api_router.get("/payments/{member_id}/{year}", response_model=List[dict])
async def get_member_payments(member_id: str, year: int, user: User = Depends(get_current_user)):
    """Get payments for a member for a specific year"""
    payments = await db.payments.find(
        {"member_id": member_id, "year": year},
        {"_id": 0}
    ).to_list(12)
    return payments


@api_router.put("/payments/{member_id}/{year}/{month}")
async def update_payment(
    member_id: str, 
    year: int, 
    month: int, 
    update: PaymentUpdate,
    user: User = Depends(get_current_user)
):
    """Update or create payment status for a specific month"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    # Check member exists
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Upsert payment
    await db.payments.update_one(
        {"member_id": member_id, "year": year, "month": month},
        {
            "$set": {
                "paid": update.paid,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "payment_id": f"payment_{uuid.uuid4().hex[:12]}",
                "member_id": member_id,
                "year": year,
                "month": month
            }
        },
        upsert=True
    )
    
    payment = await db.payments.find_one(
        {"member_id": member_id, "year": year, "month": month},
        {"_id": 0}
    )
    return payment


@api_router.get("/debug/members")
async def debug_members(user: User = Depends(get_current_user)):
    """Debug endpoint to check members"""
    try:
        print("DEBUG: Starting debug_members")
        members = await db.members.find({}, {"_id": 0}).to_list(1000)
        print(f"DEBUG: Found {len(members)} members")
        for member in members:
            print(f"DEBUG: Member: {member}")
        return {"members": members, "count": len(members)}
    except Exception as e:
        print(f"DEBUG: Exception: {e}")
        return {"error": str(e)}


@api_router.get("/debug/payments/{year}")
async def debug_payments(year: int, user: User = Depends(get_current_user)):
    """Debug payments endpoint"""
    try:
        print(f"DEBUG: Getting payments for year {year}")
        members = await db.members.find({}, {"_id": 0}).to_list(1000)
        print(f"DEBUG: Found {len(members)} members")
        
        result = []
        for member in members:
            print(f"DEBUG: Processing member: {member['member_id']}")
            # Simple result without payments for now
            member_result = {
                "member_id": member["member_id"],
                "vorname": member["vorname"],
                "name": member["name"],
                "test": "working"
            }
            result.append(member_result)
            print(f"DEBUG: Added member to result")
        
        print(f"DEBUG: Returning {len(result)} members")
        return result
    except Exception as e:
        print(f"DEBUG: Exception: {e}")
        return {"error": str(e)}


@api_router.get("/payments/year/{year}")
@api_router.get("/payments/year/{year}")
async def get_all_payments_for_year(year: int, user: User = Depends(get_current_user)):
    """Get all payments for a specific year with member info"""
    # Simple test - just return a test response
    return [{"test": "function_called", "year": year}]


# ==================== PUBLIC ROUTES ====================

@api_router.get("/public/members/{year}", response_model=List[dict])
async def get_public_member_status(year: int):
    """Public endpoint: Get all members with their payment status for a year"""
    members = await db.members.find({}, {"_id": 0}).to_list(1000)
    
    result = []
    for member in members:
        payments = await db.payments.find(
            {"member_id": member["member_id"], "year": year},
            {"_id": 0}
        ).to_list(12)
        
        payment_map = {p["month"]: p["paid"] for p in payments}
        
        result.append({
            "vorname": member["vorname"],
            "name": member["name"],
            "payments": [{"month": m, "paid": payment_map.get(m, False)} for m in range(1, 13)]
        })
    
    # Sort by name
    result.sort(key=lambda x: (x["name"], x["vorname"]))
    
    return result


# ==================== BASIC ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Vereinsmitglieder Management API"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
