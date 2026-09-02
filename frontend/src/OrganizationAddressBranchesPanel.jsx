import { EmptyState } from "./EmptyState.jsx";
import {
  composeBranchDisplay,
  emptyLocationFormState,
  parseBranchRecordForForm,
} from "./orgBranchUtils.js";

function AddressSuggestions({ items, keyPrefix, onPick }) {
  if (!items?.length) return null;
  return (
    <div className="suggestions">
      {items.map((item, idx) => (
        <button
          key={`${keyPrefix}-${item.value}-${idx}`}
          type="button"
          className="suggestion-item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item)}
        >
          {item.value}
        </button>
      ))}
    </div>
  );
}

/** Основной адрес организации и управление филиалами. */
export default function OrganizationAddressBranchesPanel({
  orgName,
  orgDisplayAddress,
  orgAddressForm,
  onOrgAddressFormChange,
  orgMainEditOpen,
  onOrgMainEditOpenChange,
  profileOrgStatus,
  onSaveOrganization,
  onSyncOrgFromMe,
  onProfileAddressInput,
  onGeocodeProfileAddress,
  onPickProfileSuggestion,
  detectedCity,
  addressSuggestions,
  branches,
  locationForm,
  onLocationFormChange,
  selectedBranchId,
  onSelectedBranchIdChange,
  branchAddOpen,
  onBranchAddOpenChange,
  branchEditOpen,
  onBranchEditOpenChange,
  branchGeoStatus,
  onCreateBranch,
  onSaveBranchEdit,
  onDeleteBranch,
  onBranchAddressInput,
  onGeocodeBranchAddress,
  onPickBranchSuggestion,
  onClearAddressSuggestions,
  onCancelOrgMainEdit,
  onClearBranchGeoStatus,
}) {
  function toggleBranchAdd() {
    onBranchAddOpenChange((v) => {
      const next = !v;
      if (next) {
        onSelectedBranchIdChange(null);
        onBranchEditOpenChange(false);
        onLocationFormChange(emptyLocationFormState());
        onClearAddressSuggestions();
        onClearBranchGeoStatus?.();
      }
      return next;
    });
  }

  const selectedBranch =
    selectedBranchId != null ? branches.find((l) => Number(l.id) === Number(selectedBranchId)) : null;

  return (
    <>
      <h3>Адрес организации (основной)</h3>
      {!orgMainEditOpen ? (
        <div className="org-main-display">
          <p className="org-display-line">
            <strong>{orgName || "—"}</strong>
          </p>
          <p className="org-display-line">{orgDisplayAddress || "Адрес не указан."}</p>
          <div id="profile-address-map" className="map-box" />
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              onSyncOrgFromMe();
              onOrgMainEditOpenChange(true);
            }}
          >
            Изменить
          </button>
          <p className="status">{profileOrgStatus}</p>
        </div>
      ) : (
        <form onSubmit={onSaveOrganization} className="form org-main-edit-form">
          <input
            placeholder="Название организации"
            value={orgAddressForm.organization_name}
            onChange={(e) => onOrgAddressFormChange({ ...orgAddressForm, organization_name: e.target.value })}
            required
          />
          <input
            placeholder="Адрес (улица, дом)"
            value={orgAddressForm.organization_address}
            onChange={(e) => onProfileAddressInput(e.target.value)}
            onBlur={(e) => onGeocodeProfileAddress(e.target.value)}
            required
          />
          {detectedCity ? <p className="hint">Город поиска: {detectedCity}</p> : null}
          <AddressSuggestions items={addressSuggestions} keyPrefix="profile" onPick={onPickProfileSuggestion} />
          <div id="profile-address-map" className="map-box" />
          <div className="address-details-grid">
            <input
              placeholder="Подъезд"
              value={orgAddressForm.entrance}
              onChange={(e) => onOrgAddressFormChange({ ...orgAddressForm, entrance: e.target.value })}
            />
            <input
              placeholder="Этаж"
              value={orgAddressForm.floor}
              onChange={(e) => onOrgAddressFormChange({ ...orgAddressForm, floor: e.target.value })}
            />
            <input
              placeholder="Квартира/офис"
              value={orgAddressForm.apartment}
              onChange={(e) => onOrgAddressFormChange({ ...orgAddressForm, apartment: e.target.value })}
            />
            <input
              placeholder="Домофон"
              value={orgAddressForm.intercom}
              onChange={(e) => onOrgAddressFormChange({ ...orgAddressForm, intercom: e.target.value })}
            />
          </div>
          <input
            placeholder="Доп. ориентир (необязательно)"
            value={orgAddressForm.organization_address_details}
            onChange={(e) =>
              onOrgAddressFormChange({ ...orgAddressForm, organization_address_details: e.target.value })
            }
          />
          <div className="row-2">
            <button type="submit">Сохранить</button>
            <button
              type="button"
              className="ghost-btn"
              onClick={onCancelOrgMainEdit}
            >
              Отмена
            </button>
          </div>
          <p className="status">{profileOrgStatus}</p>
        </form>
      )}

      <h3>Филиалы</h3>
      <button type="button" className="ghost-btn org-branch-add-toggle" onClick={toggleBranchAdd}>
        {branchAddOpen ? "Закрыть форму добавления" : "Добавить филиал"}
      </button>
      {branchAddOpen ? (
        <form onSubmit={onCreateBranch} className="form org-branch-add-form">
          <input
            placeholder="Название филиала"
            value={locationForm.title}
            onChange={(e) => onLocationFormChange({ ...locationForm, title: e.target.value })}
            required
          />
          <input
            placeholder="Адрес филиала"
            value={locationForm.address}
            onChange={(e) => onBranchAddressInput(e.target.value)}
            onBlur={() => onGeocodeBranchAddress()}
            required
          />
          {detectedCity ? <p className="hint">Город поиска: {detectedCity}</p> : null}
          <AddressSuggestions items={addressSuggestions} keyPrefix="branch-add" onPick={onPickBranchSuggestion} />
          <button type="button" className="ghost-btn" onClick={onGeocodeBranchAddress}>
            Найти адрес на карте
          </button>
          <div id="branch-add-map" className="map-box" />
          <div className="address-details-grid">
            <input
              placeholder="Подъезд"
              value={locationForm.entrance}
              onChange={(e) => onLocationFormChange({ ...locationForm, entrance: e.target.value })}
            />
            <input
              placeholder="Этаж"
              value={locationForm.floor}
              onChange={(e) => onLocationFormChange({ ...locationForm, floor: e.target.value })}
            />
            <input
              placeholder="Квартира/офис"
              value={locationForm.apartment}
              onChange={(e) => onLocationFormChange({ ...locationForm, apartment: e.target.value })}
            />
            <input
              placeholder="Домофон"
              value={locationForm.intercom}
              onChange={(e) => onLocationFormChange({ ...locationForm, intercom: e.target.value })}
            />
          </div>
          <input
            placeholder="Доп. ориентир (необязательно)"
            value={locationForm.address_details}
            onChange={(e) => onLocationFormChange({ ...locationForm, address_details: e.target.value })}
          />
          <button type="submit">Сохранить филиал</button>
        </form>
      ) : null}
      <ul className="list org-branch-list">
        {branches.map((loc) => (
          <li key={loc.id}>
            <button
              type="button"
              className={`org-branch-pick ${Number(selectedBranchId) === Number(loc.id) ? "active" : ""}`}
              onClick={() => {
                onSelectedBranchIdChange(loc.id);
                onBranchAddOpenChange(false);
                onBranchEditOpenChange(false);
                onClearBranchGeoStatus?.();
              }}
            >
              <span className="org-branch-pick-title">{loc.title}</span>
              <span className="org-branch-pick-addr muted">{composeBranchDisplay(loc)}</span>
            </button>
          </li>
        ))}
      </ul>
      {branches.length === 0 && !branchAddOpen ? (
        <EmptyState title="Пока нет филиалов">
          <p className="muted">Добавьте филиал, если у организации несколько точек на карте.</p>
        </EmptyState>
      ) : null}
      {selectedBranch && !branchAddOpen ? (
        <div className="org-branch-detail">
          <h4>{selectedBranch.title}</h4>
          <p className="org-branch-detail-addr">{composeBranchDisplay(selectedBranch)}</p>
          {!branchEditOpen ? (
            <>
              <div id="branch-detail-map" className="map-box" />
              <div className="row-2">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    onClearAddressSuggestions();
                    onBranchEditOpenChange(true);
                    onLocationFormChange(parseBranchRecordForForm(selectedBranch));
                  }}
                >
                  Изменить
                </button>
                <button type="button" className="ghost-btn" onClick={() => onDeleteBranch(selectedBranch.id)}>
                  Удалить
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={onSaveBranchEdit} className="form">
              <input
                placeholder="Название филиала"
                value={locationForm.title}
                onChange={(e) => onLocationFormChange({ ...locationForm, title: e.target.value })}
                required
              />
              <input
                placeholder="Адрес"
                value={locationForm.address}
                onChange={(e) => onBranchAddressInput(e.target.value)}
                onBlur={() => onGeocodeBranchAddress()}
                required
              />
              {detectedCity ? <p className="hint">Город поиска: {detectedCity}</p> : null}
              <AddressSuggestions items={addressSuggestions} keyPrefix="branch-edit" onPick={onPickBranchSuggestion} />
              <button type="button" className="ghost-btn" onClick={onGeocodeBranchAddress}>
                Найти адрес на карте
              </button>
              <div id="branch-edit-map" className="map-box" />
              <div className="address-details-grid">
                <input
                  placeholder="Подъезд"
                  value={locationForm.entrance}
                  onChange={(e) => onLocationFormChange({ ...locationForm, entrance: e.target.value })}
                />
                <input
                  placeholder="Этаж"
                  value={locationForm.floor}
                  onChange={(e) => onLocationFormChange({ ...locationForm, floor: e.target.value })}
                />
                <input
                  placeholder="Квартира/офис"
                  value={locationForm.apartment}
                  onChange={(e) => onLocationFormChange({ ...locationForm, apartment: e.target.value })}
                />
                <input
                  placeholder="Домофон"
                  value={locationForm.intercom}
                  onChange={(e) => onLocationFormChange({ ...locationForm, intercom: e.target.value })}
                />
              </div>
              <input
                placeholder="Доп. ориентир (необязательно)"
                value={locationForm.address_details}
                onChange={(e) => onLocationFormChange({ ...locationForm, address_details: e.target.value })}
              />
              <div className="row-2">
                <button type="submit">Сохранить</button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    onBranchEditOpenChange(false);
                    onLocationFormChange(parseBranchRecordForForm(selectedBranch));
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
      <p className="status">{branchGeoStatus}</p>
    </>
  );
}
