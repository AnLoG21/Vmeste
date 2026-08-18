import yandexLogo from "./assets/auth-yandex.png";
import okLogo from "./assets/auth-ok.png";
import mailLogo from "./assets/auth-mail.png";

export function YandexIcon() {
  return <img className="auth-social-logo" src={yandexLogo} alt="" width="40" height="40" />;
}

export function VkIcon() {
  return (
    <svg className="auth-social-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.38 17.12h-1.75c-.66 0-.86-.52-2.05-1.73-1.03-1.01-1.49-1.13-1.74-1.13-.36 0-.46.1-.46.59v1.58c0 .42-.13.68-1.26.68-1.85 0-3.9-1.12-5.34-3.2C4.62 10.86 4.03 8.57 4.03 8.1c0-.22.1-.41.59-.41h1.75c.44 0 .61.2.78.68.86 2.49 2.3 4.67 2.89 4.67.22 0 .32-.1.32-.66V9.72c-.07-1.19-.7-1.29-.7-1.71 0-.2.17-.41.44-.41h2.75c.37 0 .5.2.5.64v3.48c0 .37.17.5.27.5.22 0 .41-.13.81-.54 1.26-1.4 2.15-3.57 2.15-3.57.12-.25.32-.5.76-.5h1.75c.44 0 .54.22.44.64-.19.99-1.98 3.61-1.98 3.61-.16.25-.22.37 0 .66.17.25.73.66 1.1 1.05.85.73 1.49 1.36 1.66 1.77.17.41-.08.62-.52.62Z"
      />
    </svg>
  );
}

export function OkIcon() {
  return <img className="auth-social-logo" src={okLogo} alt="" width="40" height="40" />;
}

export function MailRuIcon() {
  return <img className="auth-social-logo" src={mailLogo} alt="" width="40" height="40" />;
}
