import { useEffect, useState } from 'react';
import { useWhatsappConfig } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { TextField, TextAreaField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

export function WhatsappConfigPage() {
  const { data: config, loading, error, refetch } = useWhatsappConfig();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageTemplateEs, setMessageTemplateEs] = useState('');
  const [messageTemplateEn, setMessageTemplateEn] = useState('');

  useEffect(() => {
    if (config) {
      setPhoneNumber(config.phoneNumber);
      setMessageTemplateEs(config.messageTemplateEs);
      setMessageTemplateEn(config.messageTemplateEn);
    }
  }, [config]);

  const { mutate, loading: saving } = useMutation(() =>
    api.patch('/whatsapp', { phoneNumber, messageTemplateEs, messageTemplateEn }),
  );

  if (loading) return <Skeleton className="h-64 w-full max-w-xl" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-text">Configuración de WhatsApp</h1>
      <p className="mt-1 text-sm text-text-muted">
        Número y plantillas del mensaje de pedido, una por idioma. Placeholders disponibles:{' '}
        <code>[nombre]</code>, <code>[tamaño]</code>, <code>[precio]</code> y <code>[link]</code>.
        En ítems sin tamaño, <code>[tamaño]</code> se quita solo del mensaje.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <TextField
          label="Número (con código de país, sin +)"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="51932770766"
        />
        <TextAreaField
          label="Plantilla del mensaje (español)"
          value={messageTemplateEs}
          onChange={(e) => setMessageTemplateEs(e.target.value)}
          rows={3}
          hint="Ej: Hola 👋 Quiero pedir: *[nombre]* ([tamaño]) — [precio]. [link]"
        />
        <TextAreaField
          label="Plantilla del mensaje (inglés)"
          value={messageTemplateEn}
          onChange={(e) => setMessageTemplateEn(e.target.value)}
          rows={3}
          hint="Ej: Hi 👋 I'd like to order: *[nombre]* ([tamaño]) — [precio]. [link]"
        />
        <Button
          type="button"
          loading={saving}
          className="self-start"
          onClick={async () => {
            const result = await mutate();
            if (result !== undefined) {
              toastSuccess('Configuración guardada');
              refetch();
            }
          }}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
