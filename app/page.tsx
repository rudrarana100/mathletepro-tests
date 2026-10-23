import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Index() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="max-w-3xl text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* Minimalist Hero Section */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
            Mathlete Pro<span className="text-primary">.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
            The elite examination engine for advanced mathematics. 
            Secure, reliable, and built for performance.
          </p>
        </div>
        
        {/* Single Smart Entry Point */}
        <div className="pt-8">
          <Link href="/auth/login">
            <Button className="h-14 px-10 text-lg font-bold bg-white text-black hover:bg-zinc-200 rounded-none tracking-wide">
              ENTER PLATFORM
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}