import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Phone, Shield, Zap, Users } from "lucide-react";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Phone className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-white">ClearLine</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Agent Login
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-8">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          AtomQuest Hackathon 1.0
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Crystal Clear
          <br />
          <span className="text-blue-400">Customer Support</span>
        </h1>

        <p className="text-xl text-slate-300 max-w-2xl mb-12">
          Enterprise-grade video calling platform. No third-party APIs — 
          every byte of media flows through our own SFU. Browser-native, 
          zero installs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mb-12">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left">
            <Shield className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-white font-semibold mb-2">Server-Routed Media</h3>
            <p className="text-slate-400 text-sm">All A/V flows through mediasoup SFU — no P2P, full server control.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left">
            <Zap className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-white font-semibold mb-2">Real-Time Signaling</h3>
            <p className="text-slate-400 text-sm">Socket.IO on custom Node server for sub-100ms signal latency.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left">
            <Users className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-white font-semibold mb-2">Zero-Install Customers</h3>
            <p className="text-slate-400 text-sm">Customers join via link — no account, no app download needed.</p>
          </div>
        </div>

        <Link
          href="/login"
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-blue-500/20"
        >
          Start as Agent →
        </Link>
      </main>

      <footer className="p-6 text-center text-slate-500 text-sm">
        ClearLine · Built for AtomQuest Hackathon 1.0
      </footer>
    </div>
  );
}
