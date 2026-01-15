import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, MessageCircle } from "lucide-react";

const Invite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const inviterName = searchParams.get("ref") || "A friend";

  useEffect(() => {
    // If user is already logged in, redirect to friends page
    if (!loading && user) {
      navigate("/friends", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription className="text-base">
            <span className="font-medium text-primary">{decodeURIComponent(inviterName)}</span> wants to make plans with you on Parade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Share your availability</p>
                <p className="text-xs text-muted-foreground">Let friends know when you're free</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">See when friends are free</p>
                <p className="text-xs text-muted-foreground">Find the perfect time to hang out</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Plan without the hassle</p>
                <p className="text-xs text-muted-foreground">No more endless group chats</p>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate("/landing")}
          >
            Join Parade
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Free to use • No credit card required
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Invite;