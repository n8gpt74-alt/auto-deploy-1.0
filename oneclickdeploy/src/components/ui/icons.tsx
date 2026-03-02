import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function IconGithub(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 18c-4.5 1.4-4.5-2.2-6.4-2.7" />
      <path d="M15 21v-3.2a2.8 2.8 0 0 0-.8-2.2c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.4 3.7 5.4 4 5.4 4a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 4 10.6c0 4.6 2.9 5.6 5.6 6a2.8 2.8 0 0 0-.8 2.2V21" />
    </IconBase>
  );
}

export function IconRocket(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 19.5c1.6-.2 3.3-.8 4.8-2.3l2.5-2.5" />
      <path d="M12.7 11.3 15 9a9.5 9.5 0 0 0 2.8-6l.2-1 .9.9 1 .9-1 .2a9.5 9.5 0 0 0-6 2.8l-2.3 2.3" />
      <path d="M9 15l-2-2" />
      <path d="M14 10l2 2" />
      <circle cx="14.5" cy="6.5" r="1" />
    </IconBase>
  );
}

export function IconRepo(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H20a1 1 0 0 1 1 1v13.5a2.5 2.5 0 0 1-2.5 2.5H4.5a1.5 1.5 0 0 0 0 3H19" />
      <path d="M8 7h8" />
    </IconBase>
  );
}

export function IconBranch(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6h5a4.5 4.5 0 0 1 4.5 4.5V15.5" />
      <path d="M6 8.5v9a4.5 4.5 0 0 0 4.5 4.5h5" />
    </IconBase>
  );
}

export function IconCloud(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 18a4 4 0 1 1 .7-8A5.5 5.5 0 0 1 18 9.2h.5a3.5 3.5 0 1 1 0 7H7Z" />
    </IconBase>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </IconBase>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-4.8" />
    </IconBase>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.2 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.8 4.2a2 2 0 0 0-3.6 0Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r=".5" />
    </IconBase>
  );
}

export function IconLoader(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    </IconBase>
  );
}
