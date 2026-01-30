import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Calendar, Check, X, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"
];

export default function PublicPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/public/members/${selectedYear}`);
        setMembers(response.data);
      } catch (error) {
        console.error("Error fetching public data:", error);
      }
      setLoading(false);
    };

    fetchPublicData();
  }, [selectedYear]);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  };

  const getMemberPaymentSummary = (payments) => {
    const paidCount = payments.filter((p) => p.paid).length;
    return { paidCount, total: 12 };
  };

  return (
    <div className="min-h-screen bg-background noise-bg" data-testid="public-page">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[hsl(220,90%,40%)] rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(220,40%,10%)]">Vereinsverwaltung</h1>
              <p className="text-sm text-muted-foreground">Beitragsübersicht</p>
            </div>
          </div>

          <Button
            onClick={() => navigate("/login")}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="admin-login-btn"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Admin Login</span>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-bg py-16 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-[hsl(220,40%,10%)] mb-4 animate-fadeIn">
            Beitragsübersicht {selectedYear}
          </h2>
          <p className="text-muted-foreground text-lg mb-8 animate-fadeIn stagger-1">
            Transparente Übersicht aller Mitgliedsbeiträge unseres Vereins
          </p>

          <div className="flex justify-center animate-fadeIn stagger-2">
            <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-28 border-0 bg-transparent" data-testid="public-year-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {getYearOptions().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Member Grid */}
      <main className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Laden...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Noch keine Mitglieder vorhanden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member, index) => {
              const { paidCount, total } = getMemberPaymentSummary(member.payments);
              const allPaid = paidCount === total;

              return (
                <Card
                  key={index}
                  className="card-hover animate-fadeIn"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  data-testid={`public-member-card-${index}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-[hsl(220,40%,10%)]">
                        {member.vorname} {member.name}
                      </CardTitle>
                      <Badge
                        className={
                          allPaid
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }
                      >
                        {paidCount}/{total}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 gap-2">
                      {member.payments.map((payment, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex flex-col items-center"
                          data-testid={`public-payment-${index}-${pIdx}`}
                        >
                          <span className="text-xs text-muted-foreground mb-1">
                            {MONTHS[pIdx]}
                          </span>
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                              payment.paid
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-red-100 text-red-400"
                            }`}
                          >
                            {payment.paid ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {members.length > 0 && (
          <div className="flex justify-center gap-8 mt-12 pt-8 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <span className="text-sm text-muted-foreground">Bezahlt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-3 h-3 text-red-400" />
              </div>
              <span className="text-sm text-muted-foreground">Offen</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Vereinsverwaltung</p>
        </div>
      </footer>
    </div>
  );
}
