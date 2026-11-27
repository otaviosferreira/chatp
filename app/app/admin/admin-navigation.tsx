import Link from "next/link";

const items = [
  { id: "inicio", label: "Visão geral", href: "/app/admin" },
  { id: "funcionarios", label: "Funcionários", href: "/app/admin/funcionarios" },
  { id: "auditoria", label: "Auditoria", href: "/app/admin/auditoria" },
  { id: "registros", label: "Registros", href: "/app/admin/registros" },
  { id: "configuracoes", label: "Configurações", href: "/app/admin/configuracoes" },
];

export function AdminNavigation({ active }: { active: string }) {
  return (
    <nav className="admin-tabs" aria-label="Navegação administrativa">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={active === item.id ? "admin-tab active" : "admin-tab"}
          aria-current={active === item.id ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
