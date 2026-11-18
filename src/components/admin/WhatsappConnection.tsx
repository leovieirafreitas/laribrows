"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, LogOut, QrCode, RefreshCw, Smartphone, WifiOff } from "lucide-react";
import { whatsappLogoutAction, whatsappQrAction, whatsappStatusAction } from "@/app/admin/(painel)/whatsapp/actions";
import type { WhatsappStatus } from "@/lib/whatsapp";

/** "(92) 99519-9964" — o WhatsApp às vezes guarda celulares sem o 9. */
function prettyNumber(n: string) {
  let d = n.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 10 && /[6-9]/.test(d[2]!)) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n;
}

const QR_REFRESH_MS = 25_000; // o QR do WhatsApp vence em ~40s
const POLL_MS = 3_000;
const GIVE_UP_MS = 3 * 60_000;

export function WhatsappConnection({ initial }: { initial: WhatsappStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<WhatsappStatus>(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pending, start] = useTransition();
  const startedAt = useRef(0);

  const loadQr = useCallback(async () => {
    const r = await whatsappQrAction();
    if ("image" in r) {
      setQr(r.image);
      setQrError(null);
    } else if ("connected" in r) {
      setQr(null);
      setStatus(await whatsappStatusAction());
      router.refresh();
    } else setQrError(r.error);
  }, [router]);

  // Enquanto o QR está na tela: confere a conexão a cada 3s e troca o QR antes de vencer.
  useEffect(() => {
    if (!qr) return;
    const poll = setInterval(async () => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setQr(null);
        setExpired(true);
        return;
      }
      const st = await whatsappStatusAction();
      if (st.state === "open") {
        setQr(null);
        setStatus(st);
        router.refresh();
      }
    }, POLL_MS);
    const refresh = setInterval(() => void loadQr(), QR_REFRESH_MS);
    return () => {
      clearInterval(poll);
      clearInterval(refresh);
    };
  }, [qr, loadQr, router]);

  function connect() {
    setExpired(false);
    setQrError(null);
    startedAt.current = Date.now();
    start(loadQr);
  }

  function logout() {
    start(async () => {
      const r = await whatsappLogoutAction();
      setConfirmLogout(false);
      if (r && !r.ok) setQrError(r.message);
      setStatus(await whatsappStatusAction());
      router.refresh();
    });
  }

  if (status.state === "nao-configurado") {
    return (
      <div className="card p-6 text-sm leading-relaxed text-plum-700">
        <p className="font-medium text-plum-900">WhatsApp ainda não configurado no servidor.</p>
        <p className="mt-2">
          Cadastre as variáveis <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_INSTANCE</code> e <code>EVOLUTION_API_KEY</code> (token da instância) e implante de novo.
        </p>
      </div>
    );
  }

  const connected = status.state === "open";

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-6">
        {"picture" in status && status.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.picture} alt="" className="size-14 rounded-full object-cover ring-2 ring-lavender-200" />
        ) : (
          <span className={`grid size-14 place-items-center rounded-full ${connected ? "bg-emerald-50 text-emerald-600" : "bg-lavender-100 text-lavender-600"}`}>
            <Smartphone className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-plum-900">
            {connected ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-600" /> Conectado
              </>
            ) : status.state === "erro" ? (
              <>
                <WifiOff className="size-4 text-rose-600" /> Sem resposta da Evolution API
              </>
            ) : (
              <>
                <WifiOff className="size-4 text-champagne-600" /> Desconectado
              </>
            )}
          </p>
          <p className="mt-0.5 text-sm text-plum-600/70">
            {connected && "number" in status
              ? `${status.name ? `${status.name} · ` : ""}${prettyNumber(status.number)}`
              : status.state === "erro"
                ? status.message
                : "As mensagens automáticas ficam pausadas até conectar."}
          </p>
        </div>
        {connected ? (
          confirmLogout ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-plum-700">Desconectar este número?</span>
              <button type="button" className="btn btn-sm bg-rose-600 text-white hover:bg-rose-700" onClick={logout} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Sim, desconectar
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmLogout(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmLogout(true)}>
              <LogOut className="size-4" /> Desconectar
            </button>
          )
        ) : (
          !qr && (
            <button type="button" className="btn btn-primary btn-sm" onClick={connect} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />} Conectar WhatsApp
            </button>
          )
        )}
      </div>

      {qrError && <p className="mx-6 mb-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{qrError}</p>}

      {expired && !qr && !connected && (
        <p className="mx-6 mb-6 rounded-2xl bg-lavender-50 px-4 py-3 text-sm text-plum-700">O QR Code expirou. Clique em “Conectar WhatsApp” para gerar outro.</p>
      )}

      {qr && (
        <div className="grid gap-6 border-t border-lavender-100 bg-lavender-50/50 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code para conectar o WhatsApp" className="mx-auto size-64 rounded-3xl border border-lavender-200 bg-white p-3 shadow-card" />
          <div className="text-sm leading-relaxed text-plum-700">
            <p className="font-display text-2xl text-plum-900">Leia o QR Code no celular</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              <li>Abra o WhatsApp do studio no celular.</li>
              <li>
                Toque em <strong className="font-medium">Configurações</strong> (ou nos três pontinhos) → <strong className="font-medium">Aparelhos conectados</strong>.
              </li>
              <li>
                Toque em <strong className="font-medium">Conectar um aparelho</strong> e aponte a câmera para este código.
              </li>
            </ol>
            <p className="mt-4 flex items-center gap-2 text-xs text-plum-600/70">
              <Loader2 className="size-3.5 animate-spin" /> Aguardando a leitura — esta tela atualiza sozinha.
            </p>
            <button type="button" className="btn btn-ghost btn-sm mt-3 -ml-3" onClick={() => start(loadQr)} disabled={pending}>
              <RefreshCw className="size-4" /> Gerar outro código
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
