import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">Mathlete Pro Gym</h1>
        <p className="text-xl text-muted-foreground">Professional Online Mathematics Platform</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl mt-8">
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Student Portal</CardTitle>
            <CardDescription>Access your assigned mock tests and practice sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/exam">
              <Button className="w-full text-lg h-12">Take Mock Test 1</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faculty / Admin</CardTitle>
            <CardDescription>Manage the master question bank and test settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin">
              <Button variant="outline" className="w-full text-lg h-12">Open Question Builder</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}