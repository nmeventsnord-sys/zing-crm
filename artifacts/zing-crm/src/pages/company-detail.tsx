import { Shell } from "@/components/layout/Shell";
import { useGetCompany, getGetCompanyQueryKey, useListDeals, getListDealsQueryKey, useListContacts, getListContactsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Globe, Users2, Building, Plus, Target } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { CompanyDialog } from "@/components/CompanyDialog";
import { ContactDialog } from "@/components/ContactDialog";
import { DealDialog } from "@/components/DealDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  prospect: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  customer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function CompanyDetail() {
  const params = useParams();
  const companyId = params.id ? parseInt(params.id, 10) : 0;

  const [editOpen, setEditOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const { data: company, isLoading: companyLoading } = useGetCompany(companyId, {
    query: { enabled: !!companyId, queryKey: getGetCompanyQueryKey(companyId) },
  });

  const { data: deals, isLoading: dealsLoading } = useListDeals(
    { companyId },
    { query: { enabled: !!companyId, queryKey: getListDealsQueryKey({ companyId }) } }
  );

  const { data: contacts, isLoading: contactsLoading } = useListContacts(
    { companyId },
    { query: { enabled: !!companyId, queryKey: getListContactsQueryKey({ companyId }) } }
  );

  if (companyLoading) {
    return (
      <Shell>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      </Shell>
    );
  }

  if (!company) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Company not found</h2>
          <p className="text-muted-foreground mt-2">The company you're looking for doesn't exist or has been deleted.</p>
          <Link href="/companies" className="mt-4">
            <Button variant="outline">Back to Companies</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center text-xl font-bold text-secondary-foreground uppercase">
              {company.name.charAt(0)}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
          </div>
          <Button onClick={() => setEditOpen(true)} variant="outline">
            Edit Company
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Industry</p>
                  <p className="text-sm">{company.industry || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Size</p>
                  <p className="text-sm">{company.size || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Website</p>
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noreferrer" className="text-sm hover:underline text-primary">
                      {company.website}
                    </a>
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>
              </div>
            </div>
            
            {company.notes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contacts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5" /> Contacts
              </CardTitle>
              <Button size="sm" onClick={() => setContactDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Contact
              </Button>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : contacts?.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No contacts for this company.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts?.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            <Link href={`/contacts/${contact.id}`} className="hover:underline hover:text-primary">
                              {contact.firstName} {contact.lastName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize text-xs ${statusColors[contact.status] || ""}`}>
                              {contact.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{contact.email || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Target className="h-5 w-5" /> Deals
              </CardTitle>
              <Button size="sm" onClick={() => setDealDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Deal
              </Button>
            </CardHeader>
            <CardContent>
              {dealsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : deals?.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No deals for this company.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deals?.map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">
                            <Link href={`/deals/${deal.id}`} className="hover:underline hover:text-primary">
                              {deal.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {deal.stage.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {deal.value ? formatCurrency(deal.value) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <CompanyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
      />

      <DealDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
      />

      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />
    </Shell>
  );
}
