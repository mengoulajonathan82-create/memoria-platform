/** Animation d'entrée à chaque changement de page du back-office. */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
