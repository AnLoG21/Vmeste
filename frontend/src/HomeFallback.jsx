/** Lightweight shell shown while App chunk loads — keeps LCP from static hero text. */
export default function HomeFallback() {
  return (
    <div className="landing page page--guest">
      <header className="hero top-row page-header-guest">
        <button type="button" className="brand-link brand-btn" aria-label="Вместе">
          <img src="/favicon.png" alt="Вместе" className="brand-logo" width="56" height="56" decoding="async" />
        </button>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <h1 className="landing-hero-title">
              Вместе — платформа для записи и автоматизации вашего бизнеса
            </h1>
            <p className="landing-hero-lead">
              Онлайн-запись клиентов, каталог услуг, чаты, карта организаций — всё в одном сервисе.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
