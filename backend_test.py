import requests
import sys
import json
from datetime import datetime

class VereinsAPITester:
    def __init__(self, base_url="https://member-portal-82.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.test_member_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n" + "="*50)
        print("TESTING PUBLIC ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        success, _ = self.run_test("Root API", "GET", "", 200)
        
        # Test public members endpoint for current year
        current_year = datetime.now().year
        success, data = self.run_test(
            f"Public Members {current_year}", 
            "GET", 
            f"public/members/{current_year}", 
            200
        )
        
        if success:
            print(f"   Found {len(data)} public members")
        
        return success

    def create_test_session(self):
        """Create a test user and session in MongoDB for testing"""
        print("\n" + "="*50)
        print("CREATING TEST SESSION")
        print("="*50)
        
        import subprocess
        
        # Create test user and session via MongoDB
        mongo_script = f'''
use('test_database');
var userId = 'test-user-{int(datetime.now().timestamp())}';
var sessionToken = 'test_session_{int(datetime.now().timestamp())}';
db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{int(datetime.now().timestamp())}@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date().toISOString()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
}});
print('SESSION_TOKEN:' + sessionToken);
print('USER_ID:' + userId);
'''
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', mongo_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                output_lines = result.stdout.split('\n')
                for line in output_lines:
                    if line.startswith('SESSION_TOKEN:'):
                        self.session_token = line.split('SESSION_TOKEN:')[1].strip()
                        print(f"✅ Created session token: {self.session_token}")
                        return True
                        
            print(f"❌ Failed to create test session")
            print(f"   stdout: {result.stdout}")
            print(f"   stderr: {result.stderr}")
            return False
            
        except Exception as e:
            print(f"❌ Error creating test session: {str(e)}")
            return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        if not self.session_token:
            print("❌ No session token available")
            return False
        
        # Test /auth/me endpoint
        success, user_data = self.run_test("Get Current User", "GET", "auth/me", 200)
        
        if success and user_data:
            print(f"   Authenticated as: {user_data.get('name', 'Unknown')}")
        
        return success

    def test_member_crud(self):
        """Test member CRUD operations"""
        print("\n" + "="*50)
        print("TESTING MEMBER CRUD OPERATIONS")
        print("="*50)
        
        if not self.session_token:
            print("❌ No session token available")
            return False
        
        # Test GET all members
        success, members = self.run_test("Get All Members", "GET", "members", 200)
        initial_count = len(members) if success else 0
        print(f"   Initial member count: {initial_count}")
        
        # Test CREATE member
        test_member = {
            "vorname": "Test",
            "name": "Mitglied"
        }
        success, created_member = self.run_test(
            "Create Member", 
            "POST", 
            "members", 
            200, 
            data=test_member
        )
        
        if success and created_member:
            self.test_member_id = created_member.get('member_id')
            print(f"   Created member ID: {self.test_member_id}")
        
        # Test GET single member
        if self.test_member_id:
            success, member = self.run_test(
                "Get Single Member", 
                "GET", 
                f"members/{self.test_member_id}", 
                200
            )
        
        # Test UPDATE member
        if self.test_member_id:
            update_data = {"vorname": "Updated", "name": "Member"}
            success, updated_member = self.run_test(
                "Update Member", 
                "PUT", 
                f"members/{self.test_member_id}", 
                200,
                data=update_data
            )
        
        # Test GET all members again to verify count increased
        success, members_after = self.run_test("Get All Members After Create", "GET", "members", 200)
        final_count = len(members_after) if success else 0
        print(f"   Final member count: {final_count}")
        
        return success

    def test_payment_operations(self):
        """Test payment operations"""
        print("\n" + "="*50)
        print("TESTING PAYMENT OPERATIONS")
        print("="*50)
        
        if not self.session_token or not self.test_member_id:
            print("❌ No session token or member ID available")
            return False
        
        current_year = datetime.now().year
        
        # Test UPDATE payment (create/update payment for month 1)
        payment_data = {"paid": True}
        success, payment = self.run_test(
            "Update Payment Status", 
            "PUT", 
            f"payments/{self.test_member_id}/{current_year}/1", 
            200,
            data=payment_data
        )
        
        # Test GET member payments for year
        success, payments = self.run_test(
            "Get Member Payments", 
            "GET", 
            f"payments/{self.test_member_id}/{current_year}", 
            200
        )
        
        if success:
            print(f"   Found {len(payments)} payment records")
        
        # Test GET all payments for year
        success, all_payments = self.run_test(
            "Get All Payments for Year", 
            "GET", 
            f"payments/year/{current_year}", 
            200
        )
        
        if success:
            print(f"   Found payments for {len(all_payments)} members")
        
        return success

    def test_delete_member(self):
        """Test member deletion (cleanup)"""
        print("\n" + "="*50)
        print("TESTING MEMBER DELETION")
        print("="*50)
        
        if not self.session_token or not self.test_member_id:
            print("❌ No session token or member ID available")
            return False
        
        # Test DELETE member
        success, _ = self.run_test(
            "Delete Member", 
            "DELETE", 
            f"members/{self.test_member_id}", 
            200
        )
        
        if success:
            print(f"   Deleted member {self.test_member_id}")
        
        return success

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n" + "="*50)
        print("CLEANING UP TEST DATA")
        print("="*50)
        
        import subprocess
        
        cleanup_script = '''
use('test_database');
var result1 = db.users.deleteMany({email: /test\\.user\\./});
var result2 = db.user_sessions.deleteMany({session_token: /test_session/});
print('Deleted ' + result1.deletedCount + ' test users');
print('Deleted ' + result2.deletedCount + ' test sessions');
'''
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', cleanup_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                print("✅ Cleanup completed")
                print(result.stdout)
            else:
                print("❌ Cleanup failed")
                print(result.stderr)
                
        except Exception as e:
            print(f"❌ Cleanup error: {str(e)}")

def main():
    print("🚀 Starting Vereinsmitglieder Management API Tests")
    print("="*60)
    
    tester = VereinsAPITester()
    
    # Test public endpoints first
    if not tester.test_public_endpoints():
        print("❌ Public endpoint tests failed, stopping")
        return 1
    
    # Create test session for authenticated tests
    if not tester.create_test_session():
        print("❌ Failed to create test session, skipping auth tests")
        return 1
    
    # Test authenticated endpoints
    success = True
    success &= tester.test_auth_endpoints()
    success &= tester.test_member_crud()
    success &= tester.test_payment_operations()
    success &= tester.test_delete_member()
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Print results
    print("\n" + "="*60)
    print("📊 TEST RESULTS")
    print("="*60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())