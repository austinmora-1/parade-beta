import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MessageCircle } from "lucide-react";
import { ConfettiBackground } from "@/components/landing/ConfettiBackground";
import { ParadeWordmark } from "@/components/ui/ParadeWordmark";

const Invite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const inviterName = searchParams.get("ref") || "A friend";

  useEffect(() => {
    if (!loading && user) {
      navigate("/friends", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0F1A14 0%, #24382D 100%)' }}>
        <div className="animate-pulse text-[#55C78E]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0F1A14 0%, #24382D 100%)' }}>
      <ConfettiBackground count={60} />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Wordmark */}
        <div className="mb-8">
          <ParadeWordmark size="lg" />
        </div>

        {/* Card */}
        <div className="w-full max-w-md rounded-2xl border border-[#55C78E]/20 bg-[#111E16]/80 backdrop-blur-sm p-8 space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Bungee, sans-serif' }}>
              You're Invited!
            </h1>
            <p className="text-[#55C78E] text-base">
              <span className="font-semibold">{decodeURIComponent(inviterName)}</span> wants to make plans with you on Parade
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#55C78E]/10 border border-[#55C78E]/10">
              <Calendar className="h-5 w-5 text-[#55C78E] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-white">Share your availability</p>
                <p className="text-xs text-[#55C78E]/70">Let friends know when you're free</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#55C78E]/10 border border-[#55C78E]/10">
              <Users className="h-5 w-5 text-[#55C78E] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-white">See when friends are free</p>
                <p className="text-xs text-[#55C78E]/70">Find the perfect time to hang out</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#55C78E]/10 border border-[#55C78E]/10">
              <MessageCircle className="h-5 w-5 text-[#55C78E] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-white">Plan without the hassle</p>
                <p className="text-xs text-[#55C78E]/70">No more endless group chats</p>
              </div>
            </div>
          </div>

          <Button
            className="w-full text-base font-bold py-6 rounded-xl"
            size="lg"
            onClick={() => navigate("/landing")}
            style={{
              fontFamily: 'Bungee, sans-serif',
              backgroundColor: '#55C78E',
              color: '#111E16',
            }}
          >
            Join the Parade
          </Button>

          <p className="text-xs text-center text-[#55C78E]/50">
            Free to use • No credit card required
          </p>
        </div>
      </div>
    </div>
  );
};

export default Invite;
