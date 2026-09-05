import { LoadErrorBanner } from "./LoadErrorBanner.jsx";
import OrgMessengerChannelsForm from "./OrgMessengerChannelsForm.jsx";
import OrgBookingMessagesSection from "./OrgBookingMessagesSection.jsx";
import OrgAcquiringFields from "./OrgAcquiringFields.jsx";
import OrgMoyNalogPanel from "./OrgMoyNalogPanel.jsx";
import OrgCalendarSection from "./OrgCalendarSection.jsx";
import OrgMessagingRemindersSection from "./OrgMessagingRemindersSection.jsx";
import VoiceAdminPanel from "./VoiceAdminPanel.jsx";
import OrgClientCardSection from "./OrgClientCardSection.jsx";
import OrganizationAddressBranchesPanel from "./OrganizationAddressBranchesPanel.jsx";
import { composeOrgDisplayFromMe } from "./addressFormat.js";
import { ORG_GALLERY_MAX_PHOTOS } from "./clientOrgFeatures.js";

/** Раздел «Организация»: профиль, каналы, эквайринг, адрес и филиалы. */
export default function OrganizationSettingsPanel({
  canManageOrgSettings,
  me,
  staffEffectivePerms,
  cabinetLoadError,
  loadSellerData,
  saveProviderOrganization,
  orgAddressForm,
  setOrgAddressForm,
  profileOrgStatus,
  saveOrgMessaging,
  orgMessagingForm,
  setOrgMessagingForm,
  orgMessagingSaveStatus,
  orgTelegramLinkInfo,
  loadOrgTelegramLink,
  refreshOrgTelegramLink,
  unlinkOrgTelegram,
  orgBookingMessages,
  setOrgBookingMessages,
  saveOrgBookingMessages,
  orgSettingsHighlight,
  saveOrgAcquiring,
  orgAcquiringForm,
  setOrgAcquiringForm,
  orgAcquiringSaveStatus,
  orgCalendarLinks,
  orgCalendarStatus,
  rotateOrgCalendarToken,
  setOrgCalendarStatus,
  authFetch,
  API_URL,
  setCurrentView,
  orgProfileForm,
  setOrgProfileForm,
  saveOrgProfileInfo,
  orgProfileSaveStatus,
  orgGalleryPhotos,
  uploadOrgGalleryPhoto,
  deleteOrgGalleryPhoto,
  openOrgPhotoLightbox,
  orgMainEditOpen,
  setOrgMainEditOpen,
  syncOrgAddressFormFromMe,
  setProfileOrgStatus,
  onProfileAddressInput,
  geocodeProfileAddress,
  pickProfileSuggestion,
  detectedCity,
  addressSuggestions,
  location,
  locationForm,
  setLocationForm,
  selectedOrgBranchId,
  setSelectedOrgBranchId,
  orgBranchAddOpen,
  setOrgBranchAddOpen,
  orgBranchEditOpen,
  setOrgBranchEditOpen,
  branchGeoStatus,
  createProviderBranch,
  saveProviderBranchEdit,
  deleteProviderBranch,
  onBranchAddressInput,
  geocodeBranchAddress,
  pickBranchLocationSuggestion,
  setAddressSuggestions,
  setBranchGeoStatus,
}) {
  if (!canManageOrgSettings) return null;
  return (
    <section className="card profile-card org-settings-card">
      <h2>Организация</h2>
      {cabinetLoadError ? (
        <LoadErrorBanner message={cabinetLoadError} onRetry={() => void loadSellerData()} />
      ) : null}
      {me?.role === "staff" && staffEffectivePerms.can_delegate_permissions && (
        <p className="muted">
          {me?.provider_sphere === "marketplaces" || me?.employer_sphere === "marketplaces"
            ? "Название организации настраивает руководитель. Команду и права — в разделе «Сотрудники»."
            : "Адрес организации и филиалы настраивает руководитель. Команду, должности и права — в разделе «Сотрудники»."}
        </p>
      )}
      {me?.role === "provider" && me?.provider_sphere === "marketplaces" && (
        <>
          <p className="muted">
            Ключи площадок, товары и заказы — в разделе «Маркетплейсы». Здесь — название организации и каналы
            уведомлений (Telegram и др.), куда уходят алерты о заказах и ошибках синка.
          </p>
          <form onSubmit={saveProviderOrganization} className="form">
            <label className="field-label" htmlFor="org-mp-name">
              Название организации
            </label>
            <input
              id="org-mp-name"
              placeholder="Название организации"
              value={orgAddressForm.organization_name}
              onChange={(e) => setOrgAddressForm({ ...orgAddressForm, organization_name: e.target.value })}
              required
            />
            <button type="submit">Сохранить</button>
            <p className="status">{profileOrgStatus}</p>
          </form>

          <h3>Уведомления и мессенджеры</h3>
          <p className="muted small">
            Подключите Telegram (рекомендуется): в «Маркетплейсы → Управление» включите «Telegram» и типы алертов —
            сообщения пойдут в этот чат организации. Push приходит на устройства с приложением.
          </p>
          <form onSubmit={saveOrgMessaging} className="form">
            <OrgMessengerChannelsForm
              form={orgMessagingForm}
              onChange={setOrgMessagingForm}
              saveStatus={orgMessagingSaveStatus}
              telegramLinkInfo={orgTelegramLinkInfo}
              onLoadTelegramLink={loadOrgTelegramLink}
              onRefreshTelegramLink={refreshOrgTelegramLink}
              onUnlinkTelegram={unlinkOrgTelegram}
            />
          </form>
        </>
      )}
      {me?.role === "provider" && me?.provider_sphere !== "marketplaces" && (
        <>
          {me?.provider_sphere !== "cafe_restaurant" ? (
            <>
              <OrgBookingMessagesSection
                messages={orgBookingMessages}
                onChange={setOrgBookingMessages}
                onSubmit={saveOrgBookingMessages}
                settingsHighlight={orgSettingsHighlight}
              />

              <h3>Предоплата при записи</h3>
              <p className="muted small">
                Чтобы снизить неприходы, включите частичную или полную предоплату. Деньги идут в магазин выбранного
                эквайера организации, не на счёт платформы. Неоплаченная запись снимается через 10 минут.
              </p>
              <form onSubmit={saveOrgAcquiring} className="form">
                <OrgAcquiringFields
                  form={orgAcquiringForm}
                  onChange={setOrgAcquiringForm}
                  saveStatus={orgAcquiringSaveStatus}
                  providerSphere={me?.provider_sphere}
                />
              </form>

              <OrgCalendarSection
                links={orgCalendarLinks}
                status={orgCalendarStatus}
                onRotateToken={rotateOrgCalendarToken}
                onCopyStatus={setOrgCalendarStatus}
              />

              <OrgMessagingRemindersSection
                form={orgMessagingForm}
                onChange={setOrgMessagingForm}
                onSubmit={saveOrgMessaging}
                saveStatus={orgMessagingSaveStatus}
                telegramLinkInfo={orgTelegramLinkInfo}
                onLoadTelegramLink={loadOrgTelegramLink}
                onRefreshTelegramLink={refreshOrgTelegramLink}
                onUnlinkTelegram={unlinkOrgTelegram}
              />

              {(me?.provider_sphere === "hair_salon" || me?.provider_sphere === "service_center") && (
                <VoiceAdminPanel
                  authFetch={authFetch}
                  API_URL={API_URL}
                  apiOrigin={String(API_URL || "").replace(/\/api\/?$/, "")}
                  onOpenSubscriptions={() => setCurrentView("subscriptions")}
                />
              )}
            </>
          ) : (
            <>
              <h3>Уведомления</h3>
              <p className="muted small">
                Подключите Telegram или другие каналы для оповещений по заказам кафе. Настройки онлайн-оплаты — во вкладке
                «Зал и меню → Режимы, доставка и оплата».
              </p>
              <form onSubmit={saveOrgMessaging} className="form">
                <OrgMessengerChannelsForm
                  form={orgMessagingForm}
                  onChange={setOrgMessagingForm}
                  saveStatus={orgMessagingSaveStatus}
                  telegramLinkInfo={orgTelegramLinkInfo}
                  onLoadTelegramLink={loadOrgTelegramLink}
                  onRefreshTelegramLink={refreshOrgTelegramLink}
                  onUnlinkTelegram={unlinkOrgTelegram}
                />
              </form>
            </>
          )}

          <OrgMoyNalogPanel authFetch={authFetch} API_URL={API_URL} />

          <OrgClientCardSection
            form={orgProfileForm}
            onChange={setOrgProfileForm}
            onSubmit={saveOrgProfileInfo}
            saveStatus={orgProfileSaveStatus}
            galleryPhotos={orgGalleryPhotos}
            onUploadGalleryPhotos={async (files) => {
              const slotsLeft = ORG_GALLERY_MAX_PHOTOS - orgGalleryPhotos.length;
              for (const f of files.slice(0, slotsLeft)) {
                const ok = await uploadOrgGalleryPhoto(f);
                if (!ok) break;
              }
            }}
            onDeleteGalleryPhoto={deleteOrgGalleryPhoto}
            onOpenGalleryLightbox={openOrgPhotoLightbox}
            organizationSlug={me?.organization_slug}
            showBookingWidget={me?.role === "provider" && me?.provider_sphere !== "cafe_restaurant"}
          />

          <OrganizationAddressBranchesPanel
            orgName={orgAddressForm.organization_name}
            orgDisplayAddress={composeOrgDisplayFromMe(me)}
            orgAddressForm={orgAddressForm}
            onOrgAddressFormChange={setOrgAddressForm}
            orgMainEditOpen={orgMainEditOpen}
            onOrgMainEditOpenChange={setOrgMainEditOpen}
            profileOrgStatus={profileOrgStatus}
            onSaveOrganization={saveProviderOrganization}
            onSyncOrgFromMe={syncOrgAddressFormFromMe}
            onCancelOrgMainEdit={() => {
              syncOrgAddressFormFromMe();
              setOrgMainEditOpen(false);
              setProfileOrgStatus("");
            }}
            onProfileAddressInput={onProfileAddressInput}
            onGeocodeProfileAddress={geocodeProfileAddress}
            onPickProfileSuggestion={pickProfileSuggestion}
            detectedCity={detectedCity}
            addressSuggestions={addressSuggestions}
            branches={location}
            locationForm={locationForm}
            onLocationFormChange={setLocationForm}
            selectedBranchId={selectedOrgBranchId}
            onSelectedBranchIdChange={setSelectedOrgBranchId}
            branchAddOpen={orgBranchAddOpen}
            onBranchAddOpenChange={setOrgBranchAddOpen}
            branchEditOpen={orgBranchEditOpen}
            onBranchEditOpenChange={setOrgBranchEditOpen}
            branchGeoStatus={branchGeoStatus}
            onCreateBranch={createProviderBranch}
            onSaveBranchEdit={saveProviderBranchEdit}
            onDeleteBranch={deleteProviderBranch}
            onBranchAddressInput={onBranchAddressInput}
            onGeocodeBranchAddress={geocodeBranchAddress}
            onPickBranchSuggestion={pickBranchLocationSuggestion}
            onClearAddressSuggestions={() => setAddressSuggestions([])}
            onClearBranchGeoStatus={() => setBranchGeoStatus("")}
          />
        </>
      )}
    </section>
  );
}
