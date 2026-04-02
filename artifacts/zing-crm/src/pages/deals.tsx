import { Shell } from "@/components/layout/Shell";
import { useGetDealsByStage, getGetDealsByStageQueryKey, useUpdateDeal, DealStageGroup, Deal } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DealDialog } from "@/components/DealDialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useListDeals, getListDealsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export default function Deals() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>("prospecting");

  const { data: deals, isLoading } = useListDeals(
    undefined,
    { query: { queryKey: getListDealsQueryKey() } }
  );

  const { data: summary } = useGetDealsByStage({ query: { queryKey: getGetDealsByStageQueryKey() } });

  const updateDeal = useUpdateDeal();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStageChange = (dealId: number, newStage: any) => {
    updateDeal.mutate(
      { id: dealId, data: { stage: newStage } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDealsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDealsByStageQueryKey() });
          toast({ title: "Deal stage updated" });
        },
        onError: () => toast({ title: "Failed to update deal stage", variant: "destructive" }),
      }
    );
  };

  const getDealsForStage = (stage: string) => {
    return deals?.filter(d => d.stage === stage) || [];
  };

  const getStageSummary = (stage: string) => {
    return summary?.find(s => s.stage === stage);
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6 h-[calc(100vh-80px)]">
        <div className="flex items-center justify-between shrink-0">
          <h1 className="text-3xl font-bold tracking-tight">Deal Pipeline</h1>
          <Button onClick={() => { setSelectedStage("prospecting"); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Deal
          </Button>
        </div>

        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageDeals = getDealsForStage(stage);
            const stageSummary = getStageSummary(stage);

            return (
              <div key={stage} className="flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-lg border">
                <div className="p-3 border-b flex justify-between items-center bg-card rounded-t-lg">
                  <div className="font-semibold">{STAGE_LABELS[stage]}</div>
                  <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {stageDeals.length}
                  </div>
                </div>
                <div className="p-3 flex justify-between items-center text-sm font-medium text-muted-foreground border-b bg-card/50">
                  <span>Total Value</span>
                  <span className={stage === 'closed_won' ? 'text-primary font-bold' : ''}>
                    {formatCurrency(stageSummary?.totalValue || 0)}
                  </span>
                </div>
                <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-24 w-full rounded-md" />
                      <Skeleton className="h-24 w-full rounded-md" />
                    </>
                  ) : stageDeals.length === 0 ? (
                    <div className="text-center p-4 text-sm text-muted-foreground border border-dashed rounded-md">
                      No deals
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <Card key={deal.id} className="hover-elevate transition-shadow border-muted bg-card">
                        <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between space-y-0">
                          <Link href={`/deals/${deal.id}`} className="font-medium leading-none hover:underline hover:text-primary">
                            {deal.title}
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0 -mt-1 -mr-1">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/deals/${deal.id}`}>View Details</Link>
                              </DropdownMenuItem>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Move to...</div>
                              {STAGES.filter(s => s !== stage).map(s => (
                                <DropdownMenuItem key={s} onClick={() => handleStageChange(deal.id, s)}>
                                  {STAGE_LABELS[s]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 flex flex-col gap-2 text-sm">
                          <div className="font-semibold">
                            {deal.value ? formatCurrency(deal.value) : "-"}
                          </div>
                          {deal.companyName && (
                            <Link href={`/companies/${deal.companyId}`} className="text-muted-foreground hover:underline text-xs truncate">
                              {deal.companyName}
                            </Link>
                          )}
                          {!deal.companyName && deal.contactName && (
                            <Link href={`/contacts/${deal.contactId}`} className="text-muted-foreground hover:underline text-xs truncate">
                              {deal.contactName}
                            </Link>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                  <Button 
                    variant="ghost" 
                    className="w-full mt-2 border border-dashed border-muted text-muted-foreground hover:text-primary"
                    onClick={() => { setSelectedStage(stage); setDialogOpen(true); }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Deal
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultStage={selectedStage as any}
      />
    </Shell>
  );
}
