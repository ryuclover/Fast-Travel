"use client"

import { useState } from "react"
import {
  HelpCircle,
  X,
  ShieldCheck,
  Calendar,
  ExternalLink,
  CheckCircle2,
  FileText,
  Clock,
  Building,
  Sparkles,
} from "lucide-react"

export function IdJovemGuideModal() {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 transition-all"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>Como emitir e garantir meu ID Jovem?</span>
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Botão Fechar */}
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">
                  Guia Oficial de Emissão: ID Jovem
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regulamentado pela Lei Federal nº 12.852/2013 e ANTT
                </p>
              </div>
            </div>

            <div className="space-y-5 text-sm text-muted-foreground">
              {/* Quem tem direito */}
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/70">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Quem tem direito ao benefício?
                </h4>
                <ul className="text-xs space-y-1.5 list-disc list-inside">
                  <li>Jovens de <strong>15 a 29 anos</strong>.</li>
                  <li>Inscritos no <strong>Cadastro Único (CadÚnico)</strong> do Governo Federal com dados atualizados nos últimos 24 meses.</li>
                  <li>Renda familiar mensal de até <strong>2 salários mínimos</strong>.</li>
                  <li><strong className="text-foreground">Não precisa ser estudante</strong> para ter direito ao ID Jovem!</li>
                </ul>
              </div>

              {/* As 4 vagas da Lei */}
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/70">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Como funcionam as vagas no ônibus?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-background/50 border border-emerald-500/20">
                    <span className="font-bold text-emerald-400 block mb-1">
                      🟢 2 Vagas 100% Gratuitas
                    </span>
                    Tarifa de transporte zero (R$ 0,00). O passageiro paga apenas eventual taxa de embarque da rodoviária.
                  </div>
                  <div className="p-3 rounded-lg bg-background/50 border border-amber-500/20">
                    <span className="font-bold text-amber-400 block mb-1">
                      🟡 2 Vagas com 50% de Desconto
                    </span>
                    Disponibilizadas imediatamente após o esgotamento das 2 primeiras vagas gratuitas.
                  </div>
                </div>
              </div>

              {/* Prazo e Onde Retirar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/60">
                  <span className="font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-4 h-4 text-primary" /> Prazo Legal de Reserva
                  </span>
                  <p>
                    A solicitação deve ser feita com antecedência mínima de <strong>3 horas</strong> e máxima de até <strong>30 dias</strong> antes da data/horário do embarque.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/60">
                  <span className="font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                    <Building className="w-4 h-4 text-primary" /> Como Reservar?
                  </span>
                  <p>
                    <strong>Online:</strong> Viações como UTIL, Guanabara e Real Expresso aceitam reserva direta pelo site com 1 clique.<br />
                    <strong>No Guichê:</strong> Para outras viações, basta apresentar o cartão ID Jovem (impresso ou no app) e documento com foto no guichê.
                  </p>
                </div>
              </div>

              {/* Link para emitir ID Jovem */}
              <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Ainda não tem sua carteirinha? Emita gratuitamente com seu NIS:
                </span>
                <a
                  href="https://idjovem.juventude.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/20 shrink-0"
                >
                  <span>Gerar ID Jovem no Gov.br</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
