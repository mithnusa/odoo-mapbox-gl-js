import { _t } from '@web/core/l10n/translation';

export function createUploadButton(onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_upload-geojson';
    btn.title = _t('Import GeoJSON File');
    btn.setAttribute('aria-label', _t('Import GeoJSON File'));
    const icon = document.createElement('span');
    icon.className = 'oi';
    icon.setAttribute('data-icon', 'upload');
    icon.style.fontSize = '15px';
    btn.appendChild(icon);
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });
    return btn;
}
