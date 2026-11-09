import { phoneProblem } from "@/lib/phone";

// Aviso discreto embaixo do campo de telefone quando o número parece errado
export default function PhoneHint({ value }) {
  const problem = phoneProblem(value);
  if (!problem) return null;
  return <p className="text-xs font-medium text-amber-700">⚠ {problem}</p>;
}
