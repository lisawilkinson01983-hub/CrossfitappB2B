import Image from "next/image";

export function Avatar({
  photo,
  name,
  size,
  showSingleBadge,
}: {
  photo: string | null;
  name: string;
  size: number;
  showSingleBadge?: boolean;
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        <Image
          src={photo}
          alt={`${name}'s photo`}
          width={size}
          height={size}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-b2b-purple/10 font-semibold text-b2b-purple"
          style={{ fontSize: size * 0.4 }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {showSingleBadge && (
        <span
          title="Single"
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-b2b-card shadow"
          style={{ width: size * 0.32, height: size * 0.32, fontSize: size * 0.2 }}
        >
          💚
        </span>
      )}
    </div>
  );
}
