import type { ReactNode } from 'react';
import { progressText, rewardText, shortDay, type LoyaltyCard, type LoyaltyProgram, type LoyaltyVoucher } from '@/app/loyalty';
import { Icon } from '@/components/ui/Icon';
import styles from './loyalty.module.css';

/** Kartu stempel visual: N kotak (target hadiah utama), kotak hadiah ditandai */
export function StampCard({ card, program, title = 'Cutless Stamp', footer }: { card: LoyaltyCard; program: LoyaltyProgram | null; title?: string; footer?: string }) {
  const boxes = Array.from({ length: card.tier2 }, (_, i) => i + 1);
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.eyebrow}>{title}</p>
        <p className={styles.count}>
          <strong>{card.stamps}</strong>/{card.tier2}
        </p>
      </div>
      <p className={styles.progress}>{progressText(card, program)}</p>
      <ol className={styles.boxes} aria-label={`${card.stamps} dari ${card.tier2} stempel`}>
        {boxes.map((n) => {
          const filled = n <= card.stamps;
          const milestone = n === card.tier1 || n === card.tier2;
          return (
            <li key={n} className={styles.box} data-filled={filled || undefined} data-milestone={milestone || undefined} aria-hidden="true">
              {milestone ? <Icon name="gift" size={20} /> : filled ? <Icon name="scissors" size={18} /> : <span>{n}</span>}
            </li>
          );
        })}
      </ol>
      <p className={styles.legend}>
        <span>
          <Icon name="gift" size={14} /> Ke-{card.tier1}: {rewardText(program?.tier1?.services)}
        </span>
        <span>
          <Icon name="gift" size={14} /> Ke-{card.tier2}: {rewardText(program?.tier2?.services)}
        </span>
      </p>
      {footer && <p className={styles.footer}>{footer}</p>}
    </div>
  );
}

/** Kartu voucher: kode besar untuk kasir, layanan, masa berlaku/status */
export function VoucherItem({ v, extra }: { v: LoyaltyVoucher; extra?: ReactNode }) {
  return (
    <div className={styles.voucher} data-status={v.status}>
      <div className={styles.voucherMain}>
        <span className={styles.voucherLabel}>{v.tier === 2 ? 'Hadiah utama' : 'Hadiah'} · gratis 1×</span>
        <span className={styles.voucherService}>{rewardText(v.services)}</span>
        <span className={styles.voucherMeta}>
          {v.status === 'active' && `Berlaku s.d. ${shortDay(v.expiresAt)}`}
          {v.status === 'redeemed' && `Dipakai${v.bookingCode ? ` · booking ${v.bookingCode}` : ''}${v.redeemedAt ? ` · ${shortDay(v.redeemedAt)}` : ''}`}
          {v.status === 'expired' && `Hangus ${shortDay(v.expiresAt)}`}
        </span>
      </div>
      <span className={styles.voucherCode} aria-label={`Kode voucher ${v.code.split('').join(' ')}`}>
        {v.code}
      </span>
      {extra}
    </div>
  );
}

