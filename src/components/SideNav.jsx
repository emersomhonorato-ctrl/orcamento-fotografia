import { useEffect } from "react";
import {
  Ban,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronsLeft,
  ChevronsRight,
  FileSignature,
  FileText,
  FolderCheck,
  HardDrive,
  Home,
  Images,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  Receipt,
  Settings,
  Sheet,
  Sparkles,
  Users,
  Wallet,
  X,
  BadgeDollarSign,
  Package,
  Kanban,
} from "lucide-react";

// Menu do estúdio, agrupado por assunto
export const NAV_GROUPS = [
  { titulo: "", itens: [["dashboard", "Início", Home]] },
  {
    titulo: "Vendas",
    itens: [
      ["crm", "CRM", Kanban],
      ["orcamentos", "Orçamentos", FileText],
      ["clientes", "Clientes", Users],
      ["cobrancas", "Cobranças", BadgeDollarSign],
      ["contratos", "Contratos", FileSignature],
    ],
  },
  {
    titulo: "Agenda",
    itens: [
      ["agenda", "Agenda", CalendarDays],
      ["natal", "Ensaios", Sparkles],
      ["mensal", "Mês a mês", CalendarRange],
      ["realizados", "Realizados", CalendarCheck],
    ],
  },
  {
    titulo: "Entregas",
    itens: [
      ["selecao", "Seleção", FolderCheck],
      ["entregas", "Entregas", Package],
      ["albuns", "Álbuns", BookOpen],
      ["hds", "HDs", HardDrive],
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      ["financeiro", "Financeiro", Wallet],
      ["contas", "Contas a pagar", Receipt],
      ["am", "Planilhas AM", Sheet],
    ],
  },
  {
    titulo: "Ferramentas",
    itens: [
      ["carrossel", "Carrossel Álbum", Images],
      ["whatsapp", "WhatsApp", MessageCircle],
      ["servicos", "Serviços", LayoutGrid],
      ["configuracoes", "Configurações", Settings],
      ["cancelados", "Cancelados", Ban],
      ["ajuda", "Ajuda", LifeBuoy],
    ],
  },
];

export const NAV_LABELS = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.itens.map(([v, l]) => [v, l])));

function Lista({ active, onChange, badges, collapsed }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_GROUPS.map((grupo) => (
        <div key={grupo.titulo || "inicio"} className="flex flex-col gap-0.5">
          {grupo.titulo ? (
            collapsed ? <div className="mx-3 my-2 border-t border-white/10" /> : <span className="mx-3 mb-1 mt-4 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7c8396]">{grupo.titulo}</span>
          ) : null}
          {grupo.itens.map(([valor, rotulo, icone]) => {
            const Icone = icone;
            const ativo = active === valor;
            const badge = badges?.[valor];
            return (
              <button
                key={valor}
                type="button"
                title={collapsed ? rotulo : undefined}
                onClick={() => onChange(valor)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors ${
                  ativo ? "bg-[#7f274f] text-white" : "text-[#cbd0dc] hover:bg-white/10 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icone className="h-4 w-4 shrink-0" />
                {collapsed ? null : <span className="truncate">{rotulo}</span>}
                {badge ? (
                  <span
                    className={`${collapsed ? "absolute right-1.5 top-1 h-2 w-2 p-0 text-[0px]" : "ml-auto px-1.5 text-[11px]"} rounded-full font-bold ${
                      badge.tom === "alerta" ? "bg-[#e2556b] text-white" : "bg-[#c4a050] text-[#171b26]"
                    }`}
                  >
                    {badge.valor}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Marca({ collapsed }) {
  return (
    <div className={`flex items-center gap-2.5 px-2 pb-4 pt-1 ${collapsed ? "justify-center px-0" : ""}`}>
      <img src="/Emerson%20Honorato%20Retratos%20Logo.png" alt="" className="h-9 w-9 shrink-0 rounded-xl bg-white/5 object-contain p-0.5" />
      {collapsed ? null : (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Emerson Honorato</p>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#c4a050]">Estúdio</p>
        </div>
      )}
    </div>
  );
}

// Computador: coluna fixa à esquerda (recolhível). Celular: gaveta aberta pelo botão ☰
export default function SideNav({ active, onChange, badges, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }) {
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const esc = (e) => e.key === "Escape" && onCloseMobile();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto bg-[#171b26] px-3 py-5 [scrollbar-width:thin] md:flex print:hidden ${collapsed ? "w-[68px]" : "w-[232px]"}`}
      >
        <Marca collapsed={collapsed} />
        <Lista active={active} onChange={onChange} badges={badges} collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`mt-auto flex items-center gap-2 rounded-xl px-3 pt-6 text-xs text-[#7c8396] hover:text-white ${collapsed ? "justify-center px-0" : ""}`}
          title={collapsed ? "Abrir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Recolher menu</>}
        </button>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/50" onClick={onCloseMobile} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col overflow-y-auto bg-[#171b26] px-3 py-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <Marca />
              <button type="button" onClick={onCloseMobile} className="rounded-full p-1.5 text-[#cbd0dc] hover:bg-white/10" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Lista
              active={active}
              badges={badges}
              onChange={(valor) => {
                onChange(valor);
                onCloseMobile();
              }}
            />
            <p className="mt-auto flex items-center gap-1.5 px-3 pt-6 text-[11px] text-[#7c8396]"><BookOpen className="h-3.5 w-3.5" />Emerson Honorato Retratos</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
