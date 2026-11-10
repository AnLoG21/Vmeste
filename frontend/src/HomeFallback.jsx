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
        <section className="landing-hero" aria-labelledby="landing-brand-fallback">
          <div className="landing-hero-stage">
            <p id="landing-brand-fallback" className="landing-brand-mark">
              Вместе
            </p>
            <h1 className="landing-hero-title">Онлайн-запись и кабинет для вашего бизнеса</h1>
            <p className="landing-hero-lead">
              Клиенты записываются сами. Вы видите расписание, чаты и команду в одном месте.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
