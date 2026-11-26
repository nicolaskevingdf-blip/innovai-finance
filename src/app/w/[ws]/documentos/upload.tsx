"use client";
import { ActionForm, Submit } from "@/components/client";
import { uploadAttachment } from "@/app/actions/documents";

export function UploadForm({ ws }: { ws: string }) {
  return (
    <ActionForm action={uploadAttachment} resetOnSuccess>
      <input type="hidden" name="ws" value={ws} />
      <label className="block"><span className="label">Tipo</span><select name="kind" className="input"><option value="invoice">Nota fiscal</option><option value="boleto">Boleto</option><option value="receipt">Recibo</option><option value="proof">Comprovante</option><option value="contract">Contrato</option><option value="bill">Fatura</option><option value="purchase">Documento de compra</option><option value="other">Outro</option></select></label>
      <label className="block"><span className="label">Arquivo (PDF ou imagem, até 10 MB)</span><input type="file" name="file" accept="application/pdf,image/*" className="input pt-2 text-[13px] file:mr-2 file:rounded-md file:border-0 file:bg-surface-3 file:px-2 file:text-fg" /></label>
      <p className="text-[12.5px] text-faint">Para vincular a um lançamento, abra o lançamento em Financeiro e anexe por lá.</p>
      <Submit className="w-full" pendingText="Enviando…">Enviar</Submit>
    </ActionForm>
  );
}
