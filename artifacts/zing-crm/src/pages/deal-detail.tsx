import { Shell } from "@/components/layout/Shell";
import { useGetDeal, getGetDealQueryKey, useListActivities, getListActivitiesQueryKey, useUpdateDeal, getListDealsQueryKey, getGetDealsByStageQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users2, CalendarDays, Calendar, CheckCircle2, Circle } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { DealDialog } from "@/components/DealDialog";
import { ActivityDialog } from "@/components/ActivityDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export default function DealDetail() {
  const params = useParams();
  const dealId = params.id ? parseInt(params.id, 10) : 0;

  const [editOpen, setEditOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  const { data: deal, isLoading: dealLoading } = useGetDeal(dealId, {
    query: { enabled: !!dealId, queryKey: getGetDealQueryKey(dealId) },
  });

  const { data: activities, isLoading: activitiesLoading } = useListActivities(
    { dealId },
    { query: { enabled: !!dealId, queryKey: getListActivitiesQueryKey({ dealId }) } }
  );

  const updateDeal = useUpdateDeal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStageChange = (newStage: string) => {
    if (!deal) return;
    updateDeal.mutate(
      { id: deal.id, data: { stage: newStage as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDealQueryKey(deal.id) });
          queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDealsByStageQueryKey() });
          toast({ title: "Deal stage updated" });
        },
        onError: () => toast({ title: "Error updating deal stage", variant: "destructive" }),
      }
    );
  };

  if (dealLoading) {
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

  if (!deal) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Deal not found</h2>
          <p className="text-muted-foreground mt-2">The deal you're looking for doesn't exist or has been deleted.</p>
          <Link href="/deals" className="mt-4">
            <Button variant="outline">Back to Pipeline</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">{deal.title}</h1>
            <div className="flex items-center gap-4 text-muted-foreground mt-1">
              <span className="font-semibold text-lg text-primary">{deal.value ? formatCurrency(deal.value) : "Value unassigned"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <Select value={deal.stage} onValueChange={handleStageChange} disabled={updateDeal.isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setEditOpen(true)} variant="outline">
              Edit Deal
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  {deal.companyId ? (
                    <Link href={`/companies/${deal.companyId}`} className="hover:underline font-medium">
                      {deal.companyName}
                    </Link>
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact</p>
                  {deal.contactId ? (
                    <Link href={`/contacts/${deal.contactId}`} className="hover:underline font-medium">
                      {deal.contactName}
                    </Link>
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expected Close</p>
                  <p className="text-sm font-medium">
                    {deal.closeDate ? formatDate(deal.closeDate) : "Not set"}
                  </p>
                </div>
              </div>
            </div>
            
            {deal.notes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          {/* Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="h-5 w-5" /> Activities
              </CardTitle>
              <Button size="sm" onClick={() => setActivityDialogOpen(true)}>
                Add Activity
              </Button>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : activities?.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  No activities logged for this deal.
                </div>
              ) : (
                <div className="space-y-4">
                  {activities?.map((activity) => (
                    <div key={activity.id} className={`flex flex-col gap-2 p-4 rounded-lg border bg-card ${activity.completed ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {activity.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                          <p className={`font-semibold ${activity.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {activity.title}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">
                          {activity.dueDate ? formatDateTime(activity.dueDate) : "-"}
                        </span>
                      </div>
                      <div className="pl-8 text-sm">
                        <Badge variant="secondary" className="capitalize mr-2">{activity.type}</Badge>
                        {activity.contactId && (
                          <span className="text-muted-foreground">
                            With <Link href={`/contacts/${activity.contactId}`} className="hover:underline text-foreground">{activity.contactName}</Link>
                          </span>
                        )}
                        {activity.description && (
                          <p className="mt-2 text-muted-foreground">{activity.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DealDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        deal={deal}
      />

      <ActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        defaultDealId={deal.id}
        defaultContactId={deal.contactId || undefined}
      />
    </Shell>
  );
}
