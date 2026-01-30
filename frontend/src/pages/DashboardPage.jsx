import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  LogOut,
  Calendar,
  Check,
  X,
  Globe,
  Download,
  FileText,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"
];

export default function DashboardPage({ user, setUser }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [formData, setFormData] = useState({ vorname: "", name: "" });

  const fetchMembers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/members`, { withCredentials: true });
      setMembers(response.data);
    } catch (error) {
      toast.error("Fehler beim Laden der Mitglieder");
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/payments/year/${selectedYear}`, {
        withCredentials: true,
      });
      setPayments(response.data);
    } catch (error) {
      toast.error("Fehler beim Laden der Beiträge");
    }
  }, [selectedYear]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMembers(), fetchPayments()]);
      setLoading(false);
    };
    loadData();
  }, [fetchMembers, fetchPayments]);

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error("Fehler beim Abmelden");
    }
  };

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setFormData({ vorname: "", name: "" });
    setMemberDialogOpen(true);
  };

  const handleOpenEditMember = (member) => {
    setEditingMember(member);
    setFormData({ vorname: member.vorname, name: member.name });
    setMemberDialogOpen(true);
  };

  const handleOpenDeleteMember = (member) => {
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleSaveMember = async () => {
    if (!formData.vorname.trim() || !formData.name.trim()) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    try {
      if (editingMember) {
        await axios.put(`${API}/members/${editingMember.member_id}`, formData, {
          withCredentials: true,
        });
        toast.success("Mitglied aktualisiert");
      } else {
        await axios.post(`${API}/members`, formData, { withCredentials: true });
        toast.success("Mitglied hinzugefügt");
      }
      setMemberDialogOpen(false);
      fetchMembers();
      fetchPayments();
    } catch (error) {
      toast.error("Fehler beim Speichern");
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    try {
      await axios.delete(`${API}/members/${memberToDelete.member_id}`, {
        withCredentials: true,
      });
      toast.success("Mitglied gelöscht");
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      fetchMembers();
      fetchPayments();
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`${API}/payments/year/${selectedYear}/export`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beitraege_${selectedYear}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV Export erfolgreich");
    } catch (error) {
      toast.error("Fehler beim Export");
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.get(`${API}/payments/year/${selectedYear}/export-pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beitraege_${selectedYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF Export erfolgreich");
    } catch (error) {
      toast.error("Fehler beim PDF Export");
    }
  };

  const handlePaymentToggle = async (memberId, month, currentPaid) => {
    try {
      await axios.put(
        `${API}/payments/${memberId}/${selectedYear}/${month}`,
        { paid: !currentPaid },
        { withCredentials: true }
      );
      fetchPayments();
    } catch (error) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  };

  const getMemberPaymentStatus = (memberPayments) => {
    const paidCount = memberPayments.filter((p) => p.paid).length;
    return { paidCount, total: 12 };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background noise-bg" data-testid="dashboard">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[hsl(220,90%,40%)] rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(220,40%,10%)]">Vereinsverwaltung</h1>
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-[hsl(220,90%,40%)] flex items-center gap-1"
              data-testid="public-view-link"
            >
              <Globe className="w-4 h-4" />
              Öffentliche Ansicht
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[hsl(220,90%,40%)] rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:inline text-sm">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem onClick={handleLogout} data-testid="logout-btn">
                  <LogOut className="w-4 h-4 mr-2" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="label-uppercase">Mitglieder</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[hsl(220,40%,10%)]" data-testid="member-count">
                {members.length}
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="label-uppercase">Bezahlt ({selectedYear})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600" data-testid="paid-count">
                {payments.reduce((acc, p) => acc + p.payments.filter((pay) => pay.paid).length, 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="label-uppercase">Offen ({selectedYear})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600" data-testid="unpaid-count">
                {payments.reduce((acc, p) => acc + p.payments.filter((pay) => !pay.paid).length, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32" data-testid="year-select">
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

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="rounded-full"
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV Export
            </Button>
            <Button
              onClick={handleOpenAddMember}
              className="btn-accent rounded-full"
              data-testid="add-member-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Mitglied hinzufügen
            </Button>
          </div>
        </div>

        {/* Payment Table */}
        <Card className="card-hover overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="payment-table">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-48">Mitglied</TableHead>
                  {MONTHS.map((month, idx) => (
                    <TableHead key={idx} className="text-center w-12">
                      {month}
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-20">Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">
                      Keine Mitglieder vorhanden. Fügen Sie Ihr erstes Mitglied hinzu.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((memberPayment) => {
                    const { paidCount, total } = getMemberPaymentStatus(memberPayment.payments);
                    return (
                      <TableRow
                        key={memberPayment.member_id}
                        className="hover:bg-muted/30 transition-colors"
                        data-testid={`member-row-${memberPayment.member_id}`}
                      >
                        <TableCell className="font-medium">
                          <span className="text-[hsl(220,40%,10%)]">
                            {memberPayment.vorname} {memberPayment.name}
                          </span>
                        </TableCell>
                        {memberPayment.payments.map((payment, idx) => (
                          <TableCell key={idx} className="text-center">
                            <Checkbox
                              checked={payment.paid}
                              onCheckedChange={() =>
                                handlePaymentToggle(memberPayment.member_id, payment.month, payment.paid)
                              }
                              className="payment-checkbox data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                              data-testid={`payment-checkbox-${memberPayment.member_id}-${payment.month}`}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          <Badge
                            variant={paidCount === total ? "default" : "secondary"}
                            className={
                              paidCount === total
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-amber-100 text-amber-700 border-amber-200"
                            }
                          >
                            {paidCount}/{total}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`member-actions-${memberPayment.member_id}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleOpenEditMember({
                                    member_id: memberPayment.member_id,
                                    vorname: memberPayment.vorname,
                                    name: memberPayment.name,
                                  })
                                }
                                data-testid={`edit-member-${memberPayment.member_id}`}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleOpenDeleteMember({
                                    member_id: memberPayment.member_id,
                                    vorname: memberPayment.vorname,
                                    name: memberPayment.name,
                                  })
                                }
                                className="text-red-600"
                                data-testid={`delete-member-${memberPayment.member_id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>

      {/* Add/Edit Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Mitglied bearbeiten" : "Neues Mitglied"}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? "Aktualisieren Sie die Mitgliedsdaten"
                : "Fügen Sie ein neues Mitglied hinzu"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="vorname">Vorname</Label>
              <Input
                id="vorname"
                value={formData.vorname}
                onChange={(e) => setFormData({ ...formData, vorname: e.target.value })}
                placeholder="Max"
                data-testid="input-vorname"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nachname</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Mustermann"
                data-testid="input-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveMember} className="btn-primary" data-testid="save-member-btn">
              {editingMember ? "Speichern" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Mitglied löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie{" "}
              <strong>
                {memberToDelete?.vorname} {memberToDelete?.name}
              </strong>{" "}
              löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMember}
              data-testid="confirm-delete-btn"
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
