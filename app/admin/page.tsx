"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import 'katex/dist/katex.min.css';
import { BlockMath } from "react-katex";

export default function AdminPage() {
  const supabase = createClient(); 

  const [statement, setStatement] = useState("What is the integral of $x^2$?");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState(0);
  const [solution, setSolution] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.from("questions").insert([
      {
        statement,
        options: JSON.stringify(options),
        correct_option_index: correctOption,
        solution,
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      alert("Error saving question: " + error.message);
    } else {
      alert("Question added successfully!");
      setStatement("");
      setOptions(["", "", "", ""]);
      setSolution("");
    }
  };

  const renderTextWithMath = (text: string) => {
    const parts = text.split(/(\$.*?\$)/g);
    return parts.map((part, index) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        return <BlockMath key={index} math={part.slice(1, -1)} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl grid md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Add New Question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Question Statement (Use $ for Math)</Label>
              <textarea
                className="w-full flex min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Options</Label>
              <RadioGroup
                value={correctOption.toString()}
                onValueChange={(val) => setCorrectOption(parseInt(val))}
                className="space-y-2"
              >
                {options.map((opt, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <Input
                      placeholder={`Option ${index + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Saving..." : "Save Question to Database"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>Live Math Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Question:</h3>
            <div className="p-4 bg-background rounded-md border">
              {renderTextWithMath(statement)}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Options:</h3>
            <div className="space-y-2">
              {options.map((opt, index) => (
                <div key={index} className={`p-3 rounded-md border ${correctOption === index ? 'border-primary bg-primary/10' : 'bg-background'}`}>
                  {String.fromCharCode(65 + index)}. {renderTextWithMath(opt)}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}