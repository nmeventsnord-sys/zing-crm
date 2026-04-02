import { Shell } from "@/components/layout/Shell";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Target, Banknote, CalendarDays, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Contacts"
            value={summary?.totalContacts}
            icon={Users}
            loading={isLoading}
            subtitle={`${summary?.newContactsThisMonth || 0} new this month`}
            href="/contacts"
          />
          <MetricCard
            title="Total Deals"
            value={summary?.totalDeals}
            icon={Target}
            loading={isLoading}
            subtitle={`${summary?.dealsClosingThisMonth || 0} closing this month`}
            href="/deals"
          />
          <MetricCard
            title="Pipeline Value"
            value={summary?.pipelineValue ? formatCurrency(summary.pipelineValue) : undefined}
            icon={TrendingUp}
            loading={isLoading}
            href="/deals"
          />
          <MetricCard
            title="Won Deals"
            value={summary?.wonDealsValue ? formatCurrency(summary.wonDealsValue) : undefined}
            icon={Banknote}
            loading={isLoading}
            href="/deals"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link href="/deals">
                <Button variant="outline" className="w-full justify-start">
                  <Target className="mr-2 h-4 w-4" /> View Deal Pipeline
                </Button>
              </Link>
              <Link href="/contacts">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" /> Browse Contacts
                </Button>
              </Link>
              <Link href="/companies">
                <Button variant="outline" className="w-full justify-start">
                  <Building2 className="mr-2 h-4 w-4" /> View Companies
                </Button>
              </Link>
              <Link href="/activities">
                <Button variant="outline" className="w-full justify-start">
                  <CalendarDays className="mr-2 h-4 w-4" /> View Activities
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function MetricCard({ title, value, icon: Icon, loading, subtitle, href }: any) {
  return (
    <Card className={href ? "hover-elevate cursor-pointer transition-colors" : ""}>
      {href ? (
        <Link href={href}>
          <div className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold">{value !== undefined ? value : "0"}</div>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </CardContent>
          </div>
        </Link>
      ) : (
        <>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">{value !== undefined ? value : "0"}</div>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
