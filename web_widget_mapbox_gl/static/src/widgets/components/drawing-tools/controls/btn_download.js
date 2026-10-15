import { _t } from '@web/core/l10n/translation';

export function createDownloadButton(onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_download-geojson';
    btn.title = _t('Export GeoJSON File');
    btn.setAttribute('aria-label', _t('Export GeoJSON File'));
    const icon = document.createElement('span');
    icon.className = 'fa fa-download';
    icon.style.fontSize = '15px';
    btn.appendChild(icon);
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });
    return btn;
}
