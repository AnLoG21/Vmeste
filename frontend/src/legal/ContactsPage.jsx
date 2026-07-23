import LegalLayout from "./LegalLayout.jsx";
import { SITE_LEGAL } from "./siteLegal.js";

export default function ContactsPage() {
  return (
    <LegalLayout title="Контакты и реквизиты" path="/contacts">
      <p>
        Настоящая страница содержит контактные данные и реквизиты исполнителя сервиса{" "}
        <strong>{SITE_LEGAL.serviceName}</strong> ({SITE_LEGAL.siteUrl}).
      </p>

      <h2>Исполнитель</h2>
      <ul className="legal-requisites">
        <li>
          <strong>ФИО:</strong> {SITE_LEGAL.executorName}
        </li>
        <li>
          <strong>Статус:</strong> {SITE_LEGAL.status}
        </li>
        <li>
          <strong>ИНН:</strong> {SITE_LEGAL.inn}
        </li>
        <li>
          <strong>Город:</strong> {SITE_LEGAL.city}
        </li>
      </ul>

      <h2>Контакты</h2>
      <ul className="legal-requisites">
        <li>
          <strong>Электронная почта:</strong>{" "}
          <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a>
        </li>
        <li>
          <strong>Телефон:</strong>{" "}
          <a href={`tel:${SITE_LEGAL.phoneRaw}`}>{SITE_LEGAL.phone}</a>
        </li>
        <li>
          <strong>Сайт:</strong>{" "}
          <a href={SITE_LEGAL.siteUrl}>{SITE_LEGAL.siteUrl}</a>
        </li>
      </ul>

      <h2>Услуги</h2>
      <p>
        Предоставление доступа к онлайн-платформе {SITE_LEGAL.serviceName} по модели подписки
        (SaaS): онлайн-запись клиентов, каталог услуг, чаты, карта организаций и иной функционал
        согласно выбранному тарифу.
      </p>
      <p>
        По вопросам оплаты, подписки и технической поддержки обращайтесь по электронной почте или
        телефону, указанным выше.
      </p>
    </LegalLayout>
  );
}
