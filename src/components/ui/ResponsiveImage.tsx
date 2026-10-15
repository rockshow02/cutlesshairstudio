import type { ImageAsset } from '@/types';
import { asset, assetSrcSet } from '@/lib/asset';

interface ResponsiveImageProps {
  image: ImageAsset;
  className?: string;
  /** true = gambar di atas lipatan (hero): eager + fetchpriority high */
  priority?: boolean;
  /** Override alt, mis. '' untuk gambar dekoratif */
  alt?: string;
}

/** <img>/<picture> dari data konten: lazy-load, ukuran intrinsik (cegah layout shift), alt dari data. */
export function ResponsiveImage({ image, className, priority, alt }: ResponsiveImageProps) {
  const img = (
    <img
      className={className}
      src={asset(image.src)}
      srcSet={assetSrcSet(image.srcSet)}
      sizes={image.sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      {...(priority ? { fetchpriority: 'high' } : {})}
    />
  );

  if (!image.mobileSrc) return img;
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={asset(image.mobileSrc)} />
      {img}
    </picture>
  );
}
