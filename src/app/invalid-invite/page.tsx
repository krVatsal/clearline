import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function InvalidInvitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Invalid Invite Link</h1>
        <p className="text-slate-400 mb-8">
          This invite link is invalid, expired, or has already been used. 
          Please ask your support agent for a new link.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
