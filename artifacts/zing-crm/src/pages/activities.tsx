import { Shell } from "@/components/layout/Shell";
import { useListActivities, getListActivitiesQueryKey, useDeleteActivity, useUpdateActivity } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MoreHorizontal, Pencil, Trash2, Phone, Mail, Users, StickyNote, CheckSquare, CheckCircle2, Circle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActivityDialog } from "@/components/ActivityDialog";
import { DeleteDialog } from "@/components/DeleteDialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const activityIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: StickyNote,
  task: CheckSquare,
};

export default function Activities() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const { data: activities, isLoading } = useListActivities(
    undefined,
    { query: { queryKey: getListActivitiesQueryKey() } }
  );

  const deleteActivity = useDeleteActivity();
  const updateActivity = useUpdateActivity();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleEdit = (activity: any) => {
    setSelectedActivity(activity);
    setDialogOpen(true);
  };

  const handleDelete = (activity: any) => {
    setSelectedActivity(activity);
    setDeleteOpen(true);
  };

  const toggleComplete = (activity: any) => {
    updateActivity.mutate(
      { id: activity.id, data: { completed: !activity.completed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
        }
      }
    );
  };

  const confirmDelete = () => {
    if (!selectedActivity) return;
    deleteActivity.mutate(
      { id: selectedActivity.id },
      {
        onSuccess: () => {
          toast({ title: "Activity deleted" });
          queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
          setDeleteOpen(false);
        },
        onError: () => {
          toast({ title: "Failed to delete activity", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <Button onClick={() => { setSelectedActivity(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Log Activity
          </Button>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Related To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-5 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : activities?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No activities found.
                  </TableCell>
                </TableRow>
              ) : (
                activities?.map((activity) => {
                  const Icon = activityIcons[activity.type] || CheckSquare;
                  return (
                    <TableRow key={activity.id} className={activity.completed ? "opacity-60 bg-muted/30" : ""}>
                      <TableCell>
                        <button 
                          onClick={() => toggleComplete(activity)}
                          className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                        >
                          {activity.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className={`font-medium ${activity.completed ? "line-through text-muted-foreground" : ""}`}>
                        {activity.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize flex items-center gap-1 w-fit">
                          <Icon className="h-3 w-3" />
                          {activity.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {activity.contactId && (
                            <Link href={`/contacts/${activity.contactId}`} className="hover:underline text-primary">
                              {activity.contactName}
                            </Link>
                          )}
                          {activity.dealId && (
                            <Link href={`/deals/${activity.dealId}`} className="hover:underline text-muted-foreground">
                              {activity.dealTitle}
                            </Link>
                          )}
                          {!activity.contactId && !activity.dealId && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={!activity.completed && activity.dueDate && new Date(activity.dueDate) < new Date() ? "text-destructive font-medium" : ""}>
                          {formatDateTime(activity.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(activity)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(activity)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
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
      </div>

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activity={selectedActivity}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Activity"
        description={`Are you sure you want to delete "${selectedActivity?.title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        isDeleting={deleteActivity.isPending}
      />
    </Shell>
  );
}
