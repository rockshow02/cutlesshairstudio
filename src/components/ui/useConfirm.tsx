import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmOptions } from './Overlay';

/**
 * Pengganti window.confirm / window.prompt.
 *   const [dialog, confirm] = useConfirm();  …  const reason = await confirm({...}); // null = batal
 *   return <>{…}{dialog}</>
 */
export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<string | null>] {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: string | null) => void } | null>(null);
  const [lastOptions, setLastOptions] = useState<ConfirmOptions>({ title: '', confirmLabel: '' });
  const ask = useCallback(
    (options: ConfirmOptions) =>
      new Promise<string | null>((resolve) => {
        setLastOptions(options);
        setState({ options, resolve });
      }),
    [],
  );
  const finish = (v: string | null) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = <ConfirmDialog open={Boolean(state)} options={state?.options ?? lastOptions} onConfirm={(v) => finish(v)} onCancel={() => finish(null)} />;
  return [dialog, ask];
}
