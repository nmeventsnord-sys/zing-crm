import { Shell } from "@/components/layout/Shell";
import { useGetContact, getGetContactQueryKey, useListDeals, getListDealsQueryKey, useListActivities, getListActivitiesQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, CalendarDays, Plus, Target, CheckSquare } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ContactDialog } from "@/components/ContactDialog";
import { DealDialog } from "@/components/DealDialog";
import { ActivityDialog } from "@/components/ActivityDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  prospect: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  customer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ContactDetail() {
  const params = useParams();
  const contactId = params.id ? parseInt(params.id, 10) : 0;

  const [editOpen, setEditOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  const { data: contact, isLoading: contactLoading } = useGetContact(contactId, {
    query: { enabled: !!contactId, queryKey: getGetContactQueryKey(contactId) },
  });

  const { data: deals, isLoading: dealsLoading } = useListDeals(
    { contactId },
    { query: { enabled: !!contactId, queryKey: getListDealsQueryKey({ contactId }) } }
  );

  const { data: activities, isLoading: activitiesLoading } = useListActivities(
    { contactId },
    { query: { enabled: !!contactId, queryKey: getListActivitiesQueryKey({ contactId }) } }
  );

  if (contactLoading) {
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

  if (!contact) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Contact not found</h2>
          <p className="text-muted-foreground mt-2">The contact you're looking for doesn't exist or has been deleted.</p>
          <Link href="/contacts" className="mt-4">
            <Button variant="outline">Back to Contacts</Button>
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
            <h1 className="text-3xl font-bold tracking-tight">{contact.firstName} {contact.lastName}</h1>
            <Badge variant="outline" className={`capitalize text-sm px-2 py-0.5 ${statusColors[contact.status] || ""}`}>
              {contact.status}
            </Badge>
          </div>
          <Button onClick={() => setEditOpen(true)} variant="outline">
            Edit Contact
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  {contact.companyId ? (
                    <Link href={`/companies/${contact.companyId}`} className="hover:underline font-medium">
                      {contact.companyName}
                    </Link>
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{contact.email || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-sm">{contact.phone || "-"}</p>
                </div>
              </div>
            </div>
            
            {contact.notes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  No deals for this contact.
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

          {/* Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="h-5 w-5" /> Activities
              </CardTitle>
              <Button size="sm" onClick={() => setActivityDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Log Activity
              </Button>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : activities?.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No activities for this contact.
                </div>
              ) : (
                <div className="space-y-4">
                  {activities?.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg border bg-card">
                      <div className="mt-0.5">
                        {activity.completed ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <div className="h-5 w-5 rounded border-2 border-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-sm ${activity.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {activity.title}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {activity.dueDate ? formatDateTime(activity.dueDate) : "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="capitalize text-[10px] px-1 py-0">{activity.type}</Badge>
                          {activity.dealId && (
                            <span>Deal: <Link href={`/deals/${activity.dealId}`} className="hover:underline">{activity.dealTitle}</Link></span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
      />

      <DealDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        deal={undefined}
      />

      <ActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        defaultContactId={contact.id}
      />
    </Shell>
  );
}
