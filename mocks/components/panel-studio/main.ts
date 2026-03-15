import { ensureStyle } from '../../../src/style/shadow';
import { getTokenCss } from '../../../src/style/tokens';
import overlayCssText from '../../../src/style/tailwind-overlay.css?inline';
import { renderMarkdownToSanitizedHtml } from '../../../src/services/renderer/renderMarkdown';
import { getMarkdownThemeCss } from '../../../src/ui/content/components/markdownTheme';
import readerAssistantMarkdownTemplate from './fixtures/reader-assistant.md?raw';
import katexCssUrl from 'katex/dist/katex.min.css?url';
import {
    Icons,
    bookmarkIcon as sharedBookmarkIcon,
    settingsIcon as sharedSettingsIcon,
    chatgptIcon as sharedChatgptIcon,
    coffeeIcon as sharedCoffeeIcon,
    copyIcon as sharedCopyIcon,
    fileCodeIcon as sharedFileCodeIcon,
    searchIcon as sharedSearchIcon,
    xIcon as sharedXIcon,
    maximizeIcon as sharedMaximizeIcon,
    minimizeIcon as sharedMinimizeIcon,
    chevronDownIcon as sharedChevronDownIcon,
    chevronRightIcon as sharedChevronRightIcon,
    folderIcon as sharedFolderIcon,
    folderOpenIcon as sharedFolderOpenIcon,
    folderPlusIcon as sharedFolderPlusIcon,
    pencilIcon as sharedPencilIcon,
    moveIcon as sharedMoveIcon,
    trashIcon as sharedTrashIcon,
    externalLinkIcon as sharedExternalLinkIcon,
    uploadIcon as sharedUploadIcon,
    downloadIcon as sharedDownloadIcon,
    sortTimeIcon as sharedSortTimeIcon,
    sortTimeAscIcon as sharedSortTimeAscIcon,
    sortAZIcon as sharedSortAZIcon,
    sortAlphaAscIcon as sharedSortAlphaAscIcon,
    checkIcon as sharedCheckIcon,
} from '../../../src/assets/icons';

const bookmarkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const settingsIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a2 2 0 0 1 2 2v.39a1 1 0 0 0 .71.95l.31.1a1 1 0 0 0 1.03-.24l.28-.29a2 2 0 0 1 2.83 0l.67.68a2 2 0 0 1 0 2.83l-.28.29a1 1 0 0 0-.24 1.03l.1.31a1 1 0 0 0 .95.71H21a2 2 0 0 1 2 2v.96a2 2 0 0 1-2 2h-.39a1 1 0 0 0-.95.71l-.1.31a1 1 0 0 0 .24 1.03l.28.29a2 2 0 0 1 0 2.83l-.67.68a2 2 0 0 1-2.83 0l-.28-.29a1 1 0 0 0-1.03-.24l-.31.1a1 1 0 0 0-.71.95V19a2 2 0 0 1-2 2h-.96a2 2 0 0 1-2-2v-.39a1 1 0 0 0-.71-.95l-.31-.1a1 1 0 0 0-1.03.24l-.29.29a2 2 0 0 1-2.83 0l-.68-.68a2 2 0 0 1 0-2.83l.29-.29a1 1 0 0 0 .24-1.03l-.1-.31A1 1 0 0 0 3 15.96V15a2 2 0 0 1 2-2h.39a1 1 0 0 0 .95-.71l.1-.31a1 1 0 0 0-.24-1.03l-.29-.29a2 2 0 0 1 0-2.83l.68-.68a2 2 0 0 1 2.83 0l.29.29a1 1 0 0 0 1.03.24l.31-.1a1 1 0 0 0 .71-.95V5a2 2 0 0 1 2-2z"/><circle cx="12" cy="12" r="3.2"/></svg>`;
const coffeeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`;
const copyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const fileCodeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/><path d="m14 3 5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5"/></svg>`;
const fileTextIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 9h1"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>`;
const locateIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>`;
const sendIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
const xIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const chevronDownIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
const chevronRightIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
const folderIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>`;
const folderOpenIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`;
const folderPlusIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>`;
const pencilIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const moveIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>`;
const trashIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
const externalLinkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
const uploadIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>`;
const downloadIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`;
const searchIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
const sortTimeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>`;
const sortTimeAscIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/><path d="m6 5 2-2 2 2"/></svg>`;
const sortAZIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h7"/><path d="m7 4-3 3 3 3"/><path d="M20 17h-7"/><path d="m17 14 3 3-3 3"/></svg>`;
const sortAlphaAscIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18V6"/><path d="m2 9 3-3 3 3"/><path d="M11 18h8"/><path d="M11 12h6"/><path d="M11 6h4"/></svg>`;
const maximizeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
const minimizeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;
const checkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4 10-10"/></svg>`;
const globeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"/></svg>`;
const languagesIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`;
const databaseIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>`;
const githubIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.72.5 12.16c0 5.16 3.3 9.54 7.88 11.08.58.11.8-.26.8-.57 0-.28-.01-1.03-.02-2.02-3.2.71-3.87-1.57-3.87-1.57-.52-1.36-1.27-1.71-1.27-1.71-1.04-.73.08-.72.08-.72 1.15.08 1.76 1.2 1.76 1.2 1.02 1.79 2.67 1.27 3.32.97.1-.76.4-1.27.73-1.56-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.32 1.18-3.14-.12-.3-.51-1.52.11-3.17 0 0 .96-.31 3.15 1.2a10.8 10.8 0 0 1 5.74 0c2.19-1.51 3.14-1.2 3.14-1.2.63 1.65.24 2.87.12 3.17.73.82 1.18 1.86 1.18 3.14 0 4.51-2.71 5.49-5.29 5.79.41.36.78 1.07.78 2.16 0 1.56-.01 2.81-.01 3.19 0 .31.21.68.81.56A11.67 11.67 0 0 0 23.5 12.16C23.5 5.72 18.35.5 12 .5Z"/></svg>`;
const layersIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18 8 4a1 1 0 0 1 0 1.64l-8 4a1 1 0 0 1-.9 0l-8-4a1 1 0 0 1 0-1.64l8-4a1 1 0 0 1 .9 0Z"/><path d="m22 12-9.17 4.58a1 1 0 0 1-.9 0L2 12"/><path d="m22 16-9.17 4.58a1 1 0 0 1-.9 0L2 16"/></svg>`;
const geminiSimpleIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.4c.59 3.79 2.02 6.2 4.18 8.03 1.49 1.27 3.32 2.1 5.42 2.77-2.1.67-3.93 1.5-5.42 2.77-2.16 1.84-3.59 4.24-4.18 8.03-.59-3.79-2.02-6.19-4.18-8.03-1.49-1.27-3.32-2.1-5.42-2.77 2.1-.67 3.93-1.5 5.42-2.77C9.98 8.6 11.41 6.19 12 2.4Z" fill="url(#mock-gemini-simple)"/><defs><linearGradient id="mock-gemini-simple" x1="4" y1="19" x2="19.4" y2="4.2" gradientUnits="userSpaceOnUse"><stop stop-color="#08B962"/><stop offset=".35" stop-color="#FABC12"/><stop offset=".68" stop-color="#F94543"/><stop offset="1" stop-color="#3186FF"/></linearGradient></defs></svg>`;
const chatgptPlatformIcon = `<svg width="16" height="16" viewBox="0 0 41 41" fill="none"><path d="M37.532 17.412A9.316 9.316 0 0035.29 4.968 9.31 9.31 0 0022.845 2.72 9.334 9.334 0 0015.68.144a9.32 9.32 0 00-7.64 5.5A9.32 9.32 0 003.006 17.23a9.31 9.31 0 007.447 13.588A9.318 9.318 0 0025.006 38.4a9.319 9.319 0 0014.455-7.582 9.319 9.319 0 00-1.929-13.407zm-17.03 18.106a7.77 7.77 0 01-5.243-2.01l.264-.152 8.71-5.03a1.614 1.614 0 00.809-1.4V14.663l3.677 2.123a.156.156 0 01.082.14v10.17a7.78 7.78 0 01-7.779 8.422zm-13.47-6.237a7.78 7.78 0 01-3.88-8.416l.264.151 8.71 5.03c.25.144.533.22.82.22.287 0 .57-.076.82-.22l10.62-6.132v4.247a.156.156 0 01-.082.14l-8.807 5.084a7.78 7.78 0 01-8.466-.104zm-1.93-16.255a7.77 7.77 0 015.617-7.381v10.551c0 .576.308 1.107.809 1.4l10.62 6.13-3.678 2.124a.156.156 0 01-.166 0l-8.807-5.084a7.769 7.769 0 01-4.395-7.74zm27.296 3.17l-10.62-6.13 3.678-2.124a.156.156 0 01.166 0l8.806 5.084a7.781 7.781 0 013.88 8.416l-.264-.151-8.71-5.03a1.625 1.625 0 00-.82-.22c-.287 0-.57.076-.82.22l-10.62 6.132v-4.247c0-.058.034-.111.082-.14l8.807-5.084a7.77 7.77 0 018.466.104zm3.65-2.216l-.264-.151-8.71-5.03a1.625 1.625 0 00-1.64 0l-10.62 6.132V10.68c0-.058.034-.111.082-.14l8.807-5.084a7.782 7.782 0 0112.345 8.524zm-20.631 6.973l-3.677-2.123a.156.156 0 01-.083-.14V8.52a7.782 7.782 0 0112.346-6.51l-.264.151-8.71 5.03a1.614 1.614 0 00-.809 1.4v12.361zm2.003 1.145l4.625-2.67 4.625 2.67v5.34l-4.625 2.67-4.625-2.67v-5.34z" fill="currentColor"></path></svg>`;
const geminiPlatformIcon = `<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Gemini</title><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#mock-gemini-fill-0)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#mock-gemini-fill-1)"></path><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#mock-gemini-fill-2)"></path><defs><linearGradient gradientUnits="userSpaceOnUse" id="mock-gemini-fill-0" x1="7" x2="11" y1="15.5" y2="12"><stop stop-color="#08B962"></stop><stop offset="1" stop-color="#08B962" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="mock-gemini-fill-1" x1="8" x2="11.5" y1="5.5" y2="11"><stop stop-color="#F94543"></stop><stop offset="1" stop-color="#F94543" stop-opacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="mock-gemini-fill-2" x1="3.5" x2="17.5" y1="13.5" y2="12"><stop stop-color="#FABC12"></stop><stop offset=".46" stop-color="#FABC12" stop-opacity="0"></stop></linearGradient></defs></svg>`;
const claudePlatformIcon = `<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Claude</title><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero"></path></svg>`;
const deepseekPlatformIcon = `<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>`;

type Theme = 'light' | 'dark';
type PanelId = 'bookmarks' | 'reader' | 'source' | 'saveMessages' | 'bookmarkSave' | 'sendPopover' | 'dialogs' | null;
type BookmarksTabId = 'bookmarks' | 'settings' | 'sponsor';
type SortMode = 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc';
type SaveFormat = 'markdown' | 'pdf';
type SettingsMenuId = 'folding-mode' | 'language' | null;
type ModalKind = 'info' | 'warning' | 'error';
type MockModalMode = 'alert' | 'confirm' | 'prompt' | 'custom';
type ImportMergeStatus = 'normal' | 'rename' | 'import' | 'duplicate';
type DialogPreviewId = 'info' | 'warning' | 'error' | 'import-merge';

type BookmarkItem = {
    id: string;
    title: string;
    userPrompt: string;
    content: string;
    folderPath: string;
    platform: 'ChatGPT' | 'Gemini' | 'Claude' | 'DeepSeek';
    timestamp: number;
    position: number;
};

type FolderNode = {
    name: string;
    path: string;
    children: FolderNode[];
    bookmarks: BookmarkItem[];
};

type MockModal = {
    action: string;
    kind: ModalKind;
    title: string;
    message: string;
    mode: MockModalMode;
    value: string;
    payload?: string | null;
    confirmText: string;
    cancelText?: string;
    danger?: boolean;
    customHtml?: string;
};

type ImportMergeEntry = {
    title: string;
    status: ImportMergeStatus;
    existingFolderPath?: string;
    existingTitle?: string;
    renameTo?: string;
};

type SettingsState = {
    platforms: {
        chatgpt: boolean;
        gemini: boolean;
        claude: boolean;
        deepseek: boolean;
    };
    chatgpt: {
        foldingMode: 'off' | 'all' | 'keep_last_n';
        defaultExpandedCount: number;
        showFoldDock: boolean;
    };
    behavior: {
        showViewSource: boolean;
        showSaveMessages: boolean;
        showWordCount: boolean;
        enableClickToCopy: boolean;
        saveContextOnly: boolean;
    };
    reader: {
        renderCodeInReader: boolean;
    };
    language: 'auto' | 'en' | 'zh_CN';
};

type MutableState = {
    theme: Theme;
    activePanel: PanelId;
    bookmarksTab: BookmarksTabId;
    query: string;
    platform: string;
    platformMenuOpen: boolean;
    sortMode: SortMode;
    selectedFolderPath: string | null;
    expandedPaths: Set<string>;
    selectedBookmarkIds: Set<string>;
    bookmarkStatus: string;
    modal: MockModal | null;
    readerIndex: number;
    readerFullscreen: boolean;
    readerStatus: string;
    readerSendPopoverOpen: boolean;
    sourceStatus: string;
    sourceTitle: string;
    saveFormat: SaveFormat;
    selectedTurns: Set<number>;
    saveMessagesStatus: string;
    bookmarkSaveTitle: string;
    bookmarkSaveSelectedFolderPath: string | null;
    bookmarkSaveExpandedPaths: Set<string>;
    bookmarkSaveInlineParentPath: string | null;
    bookmarkSaveInlineDraft: string;
    bookmarkSaveStatus: string;
    sendDraft: string;
    sendStatus: string;
    sendPopoverOpen: boolean;
    sendPopoverWidth: number;
    sendPopoverHeight: number;
    settingsMenuOpen: SettingsMenuId;
    settings: SettingsState;
};

const conversationTurns = [
    { id: 'turn-1', user: 'How should we isolate toolbar UI styles?', assistant: 'Use Shadow DOM roots for each toolbar and keep shared stylesheets deduplicated across roots.' },
    { id: 'turn-2', user: 'Design a Tailwind alias layer over AIMD tokens', assistant: 'Keep `--aimd-*` canonical and let Tailwind aliases map semantic overlay names onto those token variables.' },
    { id: 'turn-3', user: 'Create a mock-first workflow for panel redesign', assistant: 'Build mounted HTML mocks first, verify in-browser against live Shadow DOM, then migrate into the extension.' },
    { id: 'turn-4', user: 'Compare overlay-only Tailwind with full-stack UI libraries', assistant: 'Overlay-only Tailwind keeps repeated toolbar surfaces light while still improving authoring for singleton panels.' },
    { id: 'turn-5', user: 'Plan cross-browser validation for Shadow DOM surfaces', assistant: 'Chrome can prefer constructed stylesheets while Firefox falls back to style tags behind the same registry API.' },
];

const importMergePreviewEntries: ImportMergeEntry[] = [
    {
        title: 'Overlay host rollout',
        status: 'duplicate',
        existingFolderPath: 'Product/UX',
        existingTitle: 'Overlay host rollout',
    },
    {
        title: 'Panel system refresh',
        status: 'rename',
        existingFolderPath: 'Research/Archive',
        existingTitle: 'Panel system refresh',
        renameTo: 'Panel system refresh (imported)',
    },
    {
        title: 'Save context only behavior',
        status: 'import',
        existingFolderPath: 'Product/Experiments',
    },
    {
        title: 'Cross-browser adapter notes',
        status: 'normal',
        existingFolderPath: 'Research/March',
    },
];

function createInitialTree(): FolderNode[] {
    return [
        {
            name: 'Product',
            path: 'Product',
            children: [
                {
                    name: 'UX',
                    path: 'Product/UX',
                    children: [],
                    bookmarks: [
                        {
                            id: 'bk-1',
                            title: 'Overlay host rollout',
                            userPrompt: 'Ship an overlay host that feels native on ChatGPT',
                            content: 'Use a singleton host, keep toolbar light, and reserve Tailwind authoring for rich overlay surfaces.',
                            folderPath: 'Product/UX',
                            platform: 'ChatGPT',
                            timestamp: 1710702000000,
                            position: 14,
                        },
                        {
                            id: 'bk-2',
                            title: 'Design language sync',
                            userPrompt: 'Design a Tailwind alias layer over AIMD tokens',
                            content: 'Let canonical AIMD tokens own the values. Overlay-only Tailwind aliases consume them.',
                            folderPath: 'Product/UX',
                            platform: 'Claude',
                            timestamp: 1710694800000,
                            position: 22,
                        },
                    ],
                },
                {
                    name: 'Experiments',
                    path: 'Product/Experiments',
                    children: [],
                    bookmarks: [
                        {
                            id: 'bk-3',
                            title: 'Panel staging',
                            userPrompt: 'Create a mock-first workflow for panel redesign',
                            content: 'Use mounted component mocks, live Shadow DOM, and browser screenshots as the visual gate.',
                            folderPath: 'Product/Experiments',
                            platform: 'Gemini',
                            timestamp: 1710662400000,
                            position: 18,
                        },
                    ],
                },
            ],
            bookmarks: [],
        },
        {
            name: 'Research',
            path: 'Research',
            children: [
                {
                    name: 'March',
                    path: 'Research/March',
                    children: [],
                    bookmarks: [
                        {
                            id: 'bk-4',
                            title: 'Reader density',
                            userPrompt: 'Compare overlay-only Tailwind with full-stack UI libraries',
                            content: 'A repeated toolbar should not inherit a full component library runtime or stylesheet payload.',
                            folderPath: 'Research/March',
                            platform: 'DeepSeek',
                            timestamp: 1710619200000,
                            position: 9,
                        },
                    ],
                },
                {
                    name: 'April',
                    path: 'Research/April',
                    children: [],
                    bookmarks: [
                        {
                            id: 'bk-5',
                            title: 'Cross-browser seams',
                            userPrompt: 'Plan cross-browser validation for Shadow DOM surfaces',
                            content: 'Use a shared style registry that prefers adoptedStyleSheets and falls back to style tags when needed.',
                            folderPath: 'Research/April',
                            platform: 'ChatGPT',
                            timestamp: 1710532800000,
                            position: 31,
                        },
                    ],
                },
            ],
            bookmarks: [],
        },
        {
            name: 'Growth',
            path: 'Growth',
            children: [
                {
                    name: 'Support',
                    path: 'Growth/Support',
                    children: [],
                    bookmarks: [
                        {
                            id: 'bk-6',
                            title: 'Support tab copy',
                            userPrompt: 'Refine sponsor messaging without adding pressure',
                            content: 'Support UI should feel warm and honest, with direct links to GitHub and donation channels.',
                            folderPath: 'Growth/Support',
                            platform: 'Claude',
                            timestamp: 1710446400000,
                            position: 6,
                        },
                    ],
                },
            ],
            bookmarks: [],
        },
    ];
}

let folderTree = createInitialTree();
const DEFAULT_SEND_POPOVER_WIDTH = 380;
const DEFAULT_SEND_POPOVER_HEIGHT = 248;
const MIN_SEND_POPOVER_WIDTH = 320;
const MIN_SEND_POPOVER_HEIGHT = 220;
const MAX_SEND_POPOVER_WIDTH = 680;
const MAX_SEND_POPOVER_HEIGHT = 520;

const appState: MutableState = {
    theme: 'light',
    activePanel: 'bookmarks',
    bookmarksTab: 'bookmarks',
    query: '',
    platform: 'All',
    platformMenuOpen: false,
    sortMode: 'time-desc',
    selectedFolderPath: null,
    expandedPaths: new Set(['Product', 'Product/UX', 'Research', 'Research/March', 'Growth', 'Growth/Support']),
    selectedBookmarkIds: new Set<string>(),
    bookmarkStatus: '',
    modal: null,
    readerIndex: 0,
    readerFullscreen: false,
    readerStatus: '',
    readerSendPopoverOpen: false,
    sourceStatus: '',
    sourceTitle: 'Raw source',
    saveFormat: 'markdown',
    selectedTurns: new Set<number>([0, 1, 2, 3, 4]),
    saveMessagesStatus: '',
    bookmarkSaveTitle: 'Design a cross-browser overlay host',
    bookmarkSaveSelectedFolderPath: 'Product/UX',
    bookmarkSaveExpandedPaths: new Set(['Product', 'Product/UX', 'Research']),
    bookmarkSaveInlineParentPath: null,
    bookmarkSaveInlineDraft: '',
    bookmarkSaveStatus: '',
    sendDraft: 'Rewrite the panel system so it feels lighter without drifting away from the current feature contract.',
    sendStatus: '',
    sendPopoverOpen: true,
    sendPopoverWidth: DEFAULT_SEND_POPOVER_WIDTH,
    sendPopoverHeight: DEFAULT_SEND_POPOVER_HEIGHT,
    settingsMenuOpen: null,
    settings: {
        platforms: {
            chatgpt: true,
            gemini: true,
            claude: true,
            deepseek: false,
        },
        chatgpt: {
            foldingMode: 'keep_last_n',
            defaultExpandedCount: 6,
            showFoldDock: true,
        },
        behavior: {
            showViewSource: true,
            showSaveMessages: true,
            showWordCount: false,
            enableClickToCopy: true,
            saveContextOnly: false,
        },
        reader: {
            renderCodeInReader: true,
        },
        language: 'auto',
    },
};

function icon(svg: string): string {
    return `<span class="aimd-icon" aria-hidden="true">${svg}</span>`;
}

function getReaderAssistantMarkdown(bookmark: BookmarkItem): string {
    return readerAssistantMarkdownTemplate
        .replaceAll('{{TITLE}}', bookmark.title)
        .replaceAll('{{PLATFORM}}', bookmark.platform)
        .replaceAll('{{FOLDER_PATH}}', bookmark.folderPath)
        .replaceAll('{{POSITION}}', String(bookmark.position))
        .replaceAll('{{SUMMARY}}', bookmark.content);
}

function getReaderRenderedHtml(bookmark: BookmarkItem): string {
    return renderMarkdownToSanitizedHtml(getReaderAssistantMarkdown(bookmark));
}

function escapeHtml(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function buttonClass(kind: 'primary' | 'secondary' | 'ghost' | 'danger' | 'tonal' = 'secondary'): string {
    return `studio-btn studio-btn--${kind}`;
}

function modalKindLabel(kind: ModalKind): string {
    if (kind === 'warning') return 'Warning';
    if (kind === 'error') return 'Error';
    return 'Info';
}

function modalKindIcon(kind: ModalKind): string {
    if (kind === 'warning') return icon(Icons.alertTriangle);
    if (kind === 'error') return icon(Icons.xCircle);
    return icon(Icons.info);
}

function importMergeStatusLabel(status: ImportMergeStatus): string {
    if (status === 'duplicate') return 'Duplicate';
    if (status === 'rename') return 'Rename';
    if (status === 'import') return 'Context only';
    return 'Import';
}

function importMergeStatusDescription(entry: ImportMergeEntry): string {
    if (entry.status === 'duplicate') {
        return `Matches an existing bookmark in ${entry.existingFolderPath || 'the library'}, so this row will be skipped.`;
    }
    if (entry.status === 'rename') {
        return `Will land in ${entry.existingFolderPath || 'the selected folder'} as "${entry.renameTo || entry.title}".`;
    }
    if (entry.status === 'import') {
        return `Will import without the full thread body and attach to ${entry.existingFolderPath || 'the selected folder'}.`;
    }
    return `Will import directly into ${entry.existingFolderPath || 'the selected folder'} with no conflicts.`;
}

function getImportMergeSummaryItems(): Array<{ label: string; value: string }> {
    const duplicates = importMergePreviewEntries.filter((entry) => entry.status === 'duplicate').length;
    const renamed = importMergePreviewEntries.filter((entry) => entry.status === 'rename').length;
    const contextOnly = importMergePreviewEntries.filter((entry) => entry.status === 'import').length;
    const accepted = importMergePreviewEntries.filter((entry) => entry.status !== 'duplicate').length;
    return [
        { label: 'Accepted', value: String(accepted) },
        { label: 'Skipped duplicates', value: String(duplicates) },
        { label: 'Renamed titles', value: String(renamed) },
        { label: 'Save context only', value: String(contextOnly) },
    ];
}

function getImportMergeBodyHtml(): string {
    return `
      <div class="merge-summary">
        ${getImportMergeSummaryItems().map((item) => `
          <article class="merge-summary-item">
            <span class="merge-summary-item__label">${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `).join('')}
      </div>
      <div class="merge-callout">
        <strong>Warnings</strong>
        <p>Quota estimate: 38% used after import. Save context only can be toggled before import to reduce payload size.</p>
      </div>
      <div class="merge-entry-list">
        ${importMergePreviewEntries.map((entry) => `
          <article class="merge-entry">
            <div class="merge-entry__top">
              <strong>${escapeHtml(entry.title)}</strong>
              <span class="merge-entry-status" data-status="${entry.status}">${importMergeStatusLabel(entry.status)}</span>
            </div>
            <p>${escapeHtml(importMergeStatusDescription(entry))}</p>
          </article>
        `).join('')}
      </div>
    `;
}

function openDialogPreview(id: DialogPreviewId): void {
    if (id === 'info') {
        openModal({
            action: 'dialogs:info',
            kind: 'info',
            title: 'Create folder',
            message: 'Used for folder creation, move targets, rename prompts, and other non-destructive input requests in the bookmarks flow.',
            mode: 'prompt',
            value: 'Research/Archive',
            confirmText: 'Save',
            cancelText: 'Cancel',
        });
        return;
    }

    if (id === 'warning') {
        openModal({
            action: 'dialogs:warning',
            kind: 'warning',
            title: 'Delete folder',
            message: 'Used before destructive actions such as deleting a folder tree, deleting selected bookmarks, or removing a single bookmark.',
            mode: 'confirm',
            value: '',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
        });
        return;
    }

    if (id === 'error') {
        openModal({
            action: 'dialogs:error',
            kind: 'error',
            title: 'Import failed',
            message: 'Used when import, export, create, rename, or move operations fail and the user needs a clear recovery message.',
            mode: 'alert',
            value: '',
            confirmText: 'OK',
        });
        return;
    }

    openModal({
        action: 'dialogs:import-merge',
        kind: 'info',
        title: 'Import merge review',
        message: 'Use the same modal shell to surface import merge details before committing the import.',
        mode: 'custom',
        value: '',
        confirmText: 'Import 3 items',
        cancelText: 'Cancel',
        customHtml: getImportMergeBodyHtml(),
    });
}

function launcherButton(panel: Exclude<PanelId, null>, label: string, caption: string): string {
    return `
      <button class="launcher-card" data-action="open-panel" data-panel="${panel}" data-active="${appState.activePanel === panel ? '1' : '0'}">
        <div class="launcher-card__title">${label}</div>
        <div class="launcher-card__caption">${caption}</div>
      </button>
    `;
}

function splitPath(path: string | null | undefined): string[] {
    return (path || '').split('/').filter(Boolean);
}

function truncate(text: string, length: number): string {
    const chars = Array.from(text);
    if (chars.length <= length) return text;
    return `${chars.slice(0, length).join('')}…`;
}

function flattenBookmarks(nodes: FolderNode[]): BookmarkItem[] {
    const result: BookmarkItem[] = [];
    for (const node of nodes) {
        result.push(...node.bookmarks);
        result.push(...flattenBookmarks(node.children));
    }
    return result;
}

function findFolderEntry(
    path: string,
    nodes: FolderNode[],
    parentList: FolderNode[] | null = null
): { node: FolderNode; list: FolderNode[]; index: number; parentPath: string | null } | null {
    for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (node.path === path) {
            return {
                node,
                list: nodes,
                index,
                parentPath: parentList === null ? null : splitPath(node.path).slice(0, -1).join('/') || null,
            };
        }
        const child = findFolderEntry(path, node.children, node.children);
        if (child) return child;
    }
    return null;
}

function updateNodePaths(node: FolderNode, nextPath: string): void {
    const oldPath = node.path;
    node.path = nextPath;
    node.name = splitPath(nextPath).at(-1) || node.name;
    node.bookmarks.forEach((bookmark) => {
        bookmark.folderPath = nextPath;
    });
    node.children.forEach((child) => {
        const suffix = child.path.startsWith(`${oldPath}/`) ? child.path.slice(oldPath.length + 1) : child.name;
        updateNodePaths(child, `${nextPath}/${suffix}`);
    });
}

function createFolder(path: string): boolean {
    const parts = splitPath(path);
    if (parts.length === 0) return false;

    let currentList = folderTree;
    let currentPath = '';

    for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let existing = currentList.find((node) => node.name === part);
        if (!existing) {
            existing = { name: part, path: currentPath, children: [], bookmarks: [] };
            currentList.push(existing);
            currentList.sort((a, b) => a.name.localeCompare(b.name));
        }
        currentList = existing.children;
    }

    return true;
}

function renameFolder(path: string, newName: string): boolean {
    const entry = findFolderEntry(path, folderTree);
    if (!entry || !newName.trim()) return false;
    const parentPath = splitPath(path).slice(0, -1).join('/');
    const nextPath = parentPath ? `${parentPath}/${newName.trim()}` : newName.trim();
    if (entry.list.some((node, index) => index !== entry.index && node.name === newName.trim())) return false;
    updateNodePaths(entry.node, nextPath);
    entry.list.sort((a, b) => a.name.localeCompare(b.name));

    if (appState.selectedFolderPath === path) appState.selectedFolderPath = nextPath;
    if (appState.bookmarkSaveSelectedFolderPath === path) appState.bookmarkSaveSelectedFolderPath = nextPath;
    syncExpandedPathSet(appState.expandedPaths, path, nextPath);
    syncExpandedPathSet(appState.bookmarkSaveExpandedPaths, path, nextPath);
    return true;
}

function syncExpandedPathSet(set: Set<string>, oldPath: string, nextPath: string): void {
    const values = Array.from(set);
    set.clear();
    values.forEach((path) => {
        if (path === oldPath) set.add(nextPath);
        else if (path.startsWith(`${oldPath}/`)) set.add(`${nextPath}/${path.slice(oldPath.length + 1)}`);
        else set.add(path);
    });
}

function moveFolder(sourcePath: string, targetParentPath: string | null): boolean {
    const source = findFolderEntry(sourcePath, folderTree);
    if (!source) return false;
    const targetPath = targetParentPath || '';
    if (targetPath && (targetPath === sourcePath || targetPath.startsWith(`${sourcePath}/`))) return false;

    source.list.splice(source.index, 1);
    const targetList = targetPath ? findFolderEntry(targetPath, folderTree)?.node.children : folderTree;
    if (!targetList) return false;
    const nextPath = targetPath ? `${targetPath}/${source.node.name}` : source.node.name;
    updateNodePaths(source.node, nextPath);
    targetList.push(source.node);
    targetList.sort((a, b) => a.name.localeCompare(b.name));

    if (appState.selectedFolderPath === sourcePath) appState.selectedFolderPath = nextPath;
    if (appState.bookmarkSaveSelectedFolderPath === sourcePath) appState.bookmarkSaveSelectedFolderPath = nextPath;
    syncExpandedPathSet(appState.expandedPaths, sourcePath, nextPath);
    syncExpandedPathSet(appState.bookmarkSaveExpandedPaths, sourcePath, nextPath);
    return true;
}

function deleteFolder(path: string): boolean {
    const entry = findFolderEntry(path, folderTree);
    if (!entry) return false;
    const ids = collectDescendantBookmarkIds(path);
    ids.forEach((id) => appState.selectedBookmarkIds.delete(id));
    entry.list.splice(entry.index, 1);
    if (appState.selectedFolderPath === path || appState.selectedFolderPath?.startsWith(`${path}/`)) appState.selectedFolderPath = null;
    if (appState.bookmarkSaveSelectedFolderPath === path || appState.bookmarkSaveSelectedFolderPath?.startsWith(`${path}/`)) appState.bookmarkSaveSelectedFolderPath = null;
    removeExpandedBranch(appState.expandedPaths, path);
    removeExpandedBranch(appState.bookmarkSaveExpandedPaths, path);
    return true;
}

function removeExpandedBranch(set: Set<string>, path: string): void {
    Array.from(set).forEach((value) => {
        if (value === path || value.startsWith(`${path}/`)) set.delete(value);
    });
}

function findBookmarkById(id: string, nodes: FolderNode[] = folderTree): BookmarkItem | null {
    for (const node of nodes) {
        const bookmark = node.bookmarks.find((item) => item.id === id);
        if (bookmark) return bookmark;
        const child = findBookmarkById(id, node.children);
        if (child) return child;
    }
    return null;
}

function deleteBookmark(id: string, nodes: FolderNode[] = folderTree): boolean {
    for (const node of nodes) {
        const index = node.bookmarks.findIndex((item) => item.id === id);
        if (index >= 0) {
            node.bookmarks.splice(index, 1);
            appState.selectedBookmarkIds.delete(id);
            return true;
        }
        if (deleteBookmark(id, node.children)) return true;
    }
    return false;
}

function moveBookmarksToFolder(ids: string[], targetFolderPath: string): boolean {
    const target = findFolderEntry(targetFolderPath, folderTree);
    if (!target) return false;
    const moved: BookmarkItem[] = [];
    ids.forEach((id) => {
        const item = removeBookmark(id, folderTree);
        if (item) {
            item.folderPath = targetFolderPath;
            moved.push(item);
        }
    });
    target.node.bookmarks.push(...moved);
    target.node.bookmarks.sort((a, b) => b.timestamp - a.timestamp);
    return true;
}

function removeBookmark(id: string, nodes: FolderNode[]): BookmarkItem | null {
    for (const node of nodes) {
        const index = node.bookmarks.findIndex((item) => item.id === id);
        if (index >= 0) {
            return node.bookmarks.splice(index, 1)[0] || null;
        }
        const child = removeBookmark(id, node.children);
        if (child) return child;
    }
    return null;
}

function collectDescendantBookmarkIds(path: string, nodes: FolderNode[] = folderTree): string[] {
    const entry = findFolderEntry(path, nodes);
    if (!entry) return [];
    return flattenBookmarks([entry.node]).map((bookmark) => bookmark.id);
}

function getPlatformOptions(): string[] {
    const set = new Set<string>(['All']);
    flattenBookmarks(folderTree).forEach((bookmark) => set.add(bookmark.platform));
    return Array.from(set);
}

function getPlatformIcon(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'all') return Icons.layers;
    if (normalized.includes('chatgpt')) return Icons.chatgpt;
    if (normalized.includes('gemini')) return Icons.gemini;
    if (normalized.includes('claude')) return Icons.claude;
    if (normalized.includes('deepseek')) return Icons.deepseek;
    return Icons.layers;
}

function getPlatformLabel(value: string): string {
    return value === 'All' ? 'All platforms' : value;
}

function getPlatformDropdownHtml(): string {
    const options = getPlatformOptions();

    return `
      <div class="platform-dropdown" data-platform-menu="1" data-open="${appState.platformMenuOpen ? '1' : '0'}">
        <button
          class="platform-dropdown__trigger"
          type="button"
          data-action="toggle-platform-menu"
          aria-haspopup="listbox"
          aria-expanded="${appState.platformMenuOpen ? 'true' : 'false'}"
        >
          <span class="platform-dropdown__value">
            <span class="platform-option-icon">${icon(getPlatformIcon(appState.platform))}</span>
            <span class="platform-dropdown__label">${escapeHtml(getPlatformLabel(appState.platform))}</span>
          </span>
          <span class="platform-dropdown__caret">${icon(sharedChevronDownIcon)}</span>
        </button>
        <div
          class="platform-dropdown__menu"
          role="listbox"
          data-open="${appState.platformMenuOpen ? '1' : '0'}"
        >
          ${options.map((option) => `
            <button
              class="platform-dropdown__option"
              type="button"
              role="option"
              aria-selected="${appState.platform === option ? 'true' : 'false'}"
              data-action="select-platform"
              data-value="${option}"
              data-selected="${appState.platform === option ? '1' : '0'}"
            >
              <span class="platform-dropdown__value">
                <span class="platform-option-icon">${icon(getPlatformIcon(option))}</span>
                <span class="platform-dropdown__label">${escapeHtml(getPlatformLabel(option))}</span>
              </span>
              <span class="platform-option-check">${appState.platform === option ? icon(sharedCheckIcon) : ''}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
}

function bookmarkMatchesFilters(bookmark: BookmarkItem): boolean {
    const query = appState.query.trim().toLowerCase();
    const folderMatch = !appState.selectedFolderPath || bookmark.folderPath === appState.selectedFolderPath || bookmark.folderPath.startsWith(`${appState.selectedFolderPath}/`);
    const platformMatch = appState.platform === 'All' || bookmark.platform === appState.platform;
    const queryMatch = !query || `${bookmark.title} ${bookmark.userPrompt} ${bookmark.content}`.toLowerCase().includes(query);
    return folderMatch && platformMatch && queryMatch;
}

function sortBookmarks(bookmarks: BookmarkItem[]): BookmarkItem[] {
    const next = [...bookmarks];
    switch (appState.sortMode) {
        case 'time-asc':
            next.sort((a, b) => a.timestamp - b.timestamp);
            break;
        case 'alpha-asc':
            next.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'alpha-desc':
            next.sort((a, b) => b.title.localeCompare(a.title));
            break;
        default:
            next.sort((a, b) => b.timestamp - a.timestamp);
            break;
    }
    return next;
}

function countVisibleInFolder(node: FolderNode): number {
    const visibleHere = node.bookmarks.filter(bookmarkMatchesFilters).length;
    return visibleHere + node.children.reduce((sum, child) => sum + countVisibleInFolder(child), 0);
}

function getVisibleRootNodes(): FolderNode[] {
    const selected = appState.selectedFolderPath;
    if (!selected) return folderTree;
    const roots = splitPath(selected)[0];
    return folderTree.filter((node) => node.path === roots || selected.startsWith(`${node.path}/`));
}

function getEffectiveExpanded(path: string): boolean {
    if (appState.selectedFolderPath) {
        if (appState.selectedFolderPath === path) return appState.expandedPaths.has(path);
        if (appState.selectedFolderPath.startsWith(`${path}/`)) return true;
    }
    return appState.expandedPaths.has(path);
}

function getVisibleBookmarksForReader(): BookmarkItem[] {
    return sortBookmarks(flattenBookmarks(folderTree).filter(bookmarkMatchesFilters));
}

function currentReaderBookmark(): BookmarkItem | null {
    const items = getVisibleBookmarksForReader();
    return items[appState.readerIndex] || items[0] || null;
}

function openReaderForBookmark(id: string): void {
    const items = getVisibleBookmarksForReader();
    const index = items.findIndex((bookmark) => bookmark.id === id);
    appState.readerIndex = index >= 0 ? index : 0;
    appState.activePanel = 'reader';
    appState.readerStatus = '';
    appState.readerSendPopoverOpen = false;
}

function openModal(config: MockModal): void {
    appState.modal = config;
}

function closeModal(): void {
    appState.modal = null;
}

function resetTransientUiState(): void {
    appState.modal = null;
    appState.platformMenuOpen = false;
    appState.settingsMenuOpen = null;
    appState.readerSendPopoverOpen = false;
    appState.bookmarkSaveInlineParentPath = null;
    appState.bookmarkSaveInlineDraft = '';
}

function getSettingsSelectLabel(menu: Exclude<SettingsMenuId, null>): string {
    if (menu === 'folding-mode') {
        if (appState.settings.chatgpt.foldingMode === 'off') return 'Off';
        if (appState.settings.chatgpt.foldingMode === 'all') return 'Fold all';
        return 'Keep last N';
    }

    if (appState.settings.language === 'en') return 'English';
    if (appState.settings.language === 'zh_CN') return '简体中文';
    return 'Auto';
}

function getSettingsSelectOptions(menu: Exclude<SettingsMenuId, null>): Array<{ value: string; label: string }> {
    if (menu === 'folding-mode') {
        return [
            { value: 'off', label: 'Off' },
            { value: 'all', label: 'Fold all' },
            { value: 'keep_last_n', label: 'Keep last N' },
        ];
    }

    return [
        { value: 'auto', label: 'Auto' },
        { value: 'en', label: 'English' },
        { value: 'zh_CN', label: '简体中文' },
    ];
}

function renderSettingsSelect(menu: Exclude<SettingsMenuId, null>): string {
    const open = appState.settingsMenuOpen === menu;
    const selectedValue = menu === 'folding-mode' ? appState.settings.chatgpt.foldingMode : appState.settings.language;
    return `
      <div class="settings-select-shell" data-settings-menu="${menu}" data-open="${open ? '1' : '0'}">
        <button
          class="settings-select-trigger"
          type="button"
          data-action="toggle-settings-menu"
          data-menu="${menu}"
          aria-haspopup="listbox"
          aria-expanded="${open ? 'true' : 'false'}"
        >
          <span class="settings-select-trigger__label">${escapeHtml(getSettingsSelectLabel(menu))}</span>
          <span class="settings-select-trigger__caret">${icon(sharedChevronDownIcon)}</span>
        </button>
        <div class="settings-select-menu" role="listbox" data-open="${open ? '1' : '0'}">
          ${getSettingsSelectOptions(menu).map((option) => `
            <button
              class="settings-select-option"
              type="button"
              role="option"
              aria-selected="${selectedValue === option.value ? 'true' : 'false'}"
              data-action="select-settings-option"
              data-menu="${menu}"
              data-value="${option.value}"
              data-selected="${selectedValue === option.value ? '1' : '0'}"
            >
              <span class="settings-select-trigger__label">${escapeHtml(option.label)}</span>
              <span class="platform-option-check">${selectedValue === option.value ? icon(sharedCheckIcon) : ''}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
}

function confirmModal(): void {
    const modal = appState.modal;
    if (!modal) return;
    const value = modal.value.trim();

    switch (modal.action) {
        case 'bookmarks:create-folder': {
            const ok = createFolder(value);
            appState.bookmarkStatus = ok ? `Created folder "${value}".` : 'Folder name is required.';
            break;
        }
        case 'bookmarks:create-subfolder': {
            const parent = modal.payload || '';
            const ok = createFolder(parent ? `${parent}/${value}` : value);
            if (ok) appState.expandedPaths.add(parent);
            appState.bookmarkStatus = ok ? `Created subfolder under "${parent}".` : 'Folder name is required.';
            break;
        }
        case 'bookmarks:rename-folder': {
            const ok = modal.payload ? renameFolder(modal.payload, value) : false;
            appState.bookmarkStatus = ok ? `Renamed folder to "${value}".` : 'Unable to rename that folder.';
            break;
        }
        case 'bookmarks:move-folder': {
            const ok = modal.payload ? moveFolder(modal.payload, value || null) : false;
            appState.bookmarkStatus = ok ? `Moved folder into "${value || 'root'}".` : 'Unable to move that folder.';
            break;
        }
        case 'bookmarks:delete-folder': {
            const ok = modal.payload ? deleteFolder(modal.payload) : false;
            appState.bookmarkStatus = ok ? 'Deleted folder tree.' : 'Unable to delete that folder.';
            break;
        }
        case 'bookmarks:delete-bookmark': {
            const ok = modal.payload ? deleteBookmark(modal.payload) : false;
            appState.bookmarkStatus = ok ? 'Deleted bookmark.' : 'Unable to delete bookmark.';
            break;
        }
        case 'bookmarks:move-selection': {
            const ids = Array.from(appState.selectedBookmarkIds);
            const ok = moveBookmarksToFolder(ids, value);
            appState.bookmarkStatus = ok ? `Moved ${ids.length} selected bookmark(s).` : 'Choose an existing folder path.';
            if (ok) appState.selectedBookmarkIds.clear();
            break;
        }
        case 'bookmarkSave:create-root-folder': {
            const ok = createFolder(value);
            appState.bookmarkSaveStatus = ok ? `Created folder "${value}".` : 'Folder name is required.';
            if (ok) {
                appState.bookmarkSaveSelectedFolderPath = value;
                splitPath(value).reduce((acc, part) => {
                    const next = acc ? `${acc}/${part}` : part;
                    appState.bookmarkSaveExpandedPaths.add(next);
                    return next;
                }, '');
            }
            break;
        }
        default:
            break;
    }

    closeModal();
}

function handleInlineBookmarkSaveFolder(): void {
    const parent = appState.bookmarkSaveInlineParentPath;
    const name = appState.bookmarkSaveInlineDraft.trim();
    if (!parent || !name) return;
    const path = `${parent}/${name}`;
    const ok = createFolder(path);
    appState.bookmarkSaveStatus = ok ? `Created subfolder "${name}".` : 'Unable to create subfolder.';
    if (ok) {
        appState.bookmarkSaveSelectedFolderPath = path;
        appState.bookmarkSaveExpandedPaths.add(parent);
        appState.bookmarkSaveExpandedPaths.add(path);
        appState.bookmarkSaveInlineParentPath = null;
        appState.bookmarkSaveInlineDraft = '';
    }
}

function toggleFolderSelection(path: string): void {
    const ids = collectDescendantBookmarkIds(path);
    const allSelected = ids.length > 0 && ids.every((id) => appState.selectedBookmarkIds.has(id));
    ids.forEach((id) => {
        if (allSelected) appState.selectedBookmarkIds.delete(id);
        else appState.selectedBookmarkIds.add(id);
    });
}

function folderSelectionState(path: string): 'off' | 'mixed' | 'checked' {
    const ids = collectDescendantBookmarkIds(path);
    if (ids.length === 0) return 'off';
    const selected = ids.filter((id) => appState.selectedBookmarkIds.has(id)).length;
    if (selected === 0) return 'off';
    if (selected === ids.length) return 'checked';
    return 'mixed';
}

function settingsStoragePercent(): number {
    return 38;
}

function renderFolderNode(node: FolderNode, depth: number): string {
    const visibleCount = countVisibleInFolder(node);
    const shouldShow = visibleCount > 0 || appState.selectedFolderPath === node.path || appState.selectedFolderPath?.startsWith(`${node.path}/`);
    if (!shouldShow) return '';

    const bookmarks = sortBookmarks(node.bookmarks.filter(bookmarkMatchesFilters));
    const children = node.children.map((child) => renderFolderNode(child, depth + 1)).join('');
    const hasChildren = bookmarks.length > 0 || node.children.some((child) => countVisibleInFolder(child) > 0);
    const expanded = getEffectiveExpanded(node.path);
    const selection = folderSelectionState(node.path);
    return `
      <div class="tree-node">
        <div class="tree-item tree-item--folder" data-action="toggle-folder-expand" data-path="${node.path}" data-selected="0" style="--depth:${depth};">
          <button class="tree-caret" data-action="toggle-folder-expand" data-path="${node.path}" aria-label="${expanded ? 'Collapse folder' : 'Expand folder'}" ${hasChildren ? '' : 'disabled'}>
            ${hasChildren ? icon(expanded ? sharedChevronDownIcon : sharedChevronRightIcon) : ''}
          </button>
          <input
            class="tree-check"
            type="checkbox"
            data-action="toggle-folder-selection"
            data-path="${node.path}"
            data-indeterminate="${selection === 'mixed' ? '1' : '0'}"
            aria-checked="${selection === 'checked' ? 'true' : selection === 'mixed' ? 'mixed' : 'false'}"
            ${selection === 'checked' ? 'checked' : ''}
          />
          <span class="tree-folder-icon">${icon(expanded ? sharedFolderOpenIcon : sharedFolderIcon)}</span>
          <button class="tree-main tree-main--folder" data-action="toggle-folder-expand" data-path="${node.path}">
            <span class="tree-label">${node.name}</span>
          </button>
          <span class="tree-count">${visibleCount}</span>
          <div class="tree-actions">
            <button class="icon-btn" data-action="bookmarks-folder-action" data-op="create-subfolder" data-path="${node.path}" aria-label="Create subfolder">${icon(sharedFolderPlusIcon)}</button>
            <button class="icon-btn" data-action="bookmarks-folder-action" data-op="rename-folder" data-path="${node.path}" aria-label="Rename folder">${icon(sharedPencilIcon)}</button>
            <button class="icon-btn" data-action="bookmarks-folder-action" data-op="move-folder" data-path="${node.path}" aria-label="Move folder">${icon(sharedMoveIcon)}</button>
            <button class="icon-btn icon-btn--danger" data-action="bookmarks-folder-action" data-op="delete-folder" data-path="${node.path}" aria-label="Delete folder">${icon(sharedTrashIcon)}</button>
          </div>
        </div>
        <div class="tree-children" data-expanded="${expanded ? '1' : '0'}">
          ${children}
          ${bookmarks.map((bookmark) => renderBookmarkRow(bookmark, depth + 1)).join('')}
        </div>
      </div>
    `;
}

function renderBookmarkRow(bookmark: BookmarkItem, depth: number): string {
    return `
      <div class="tree-item tree-item--bookmark" style="--depth:${depth};">
        <span class="tree-caret-slot" aria-hidden="true"></span>
        <input
          class="tree-check"
          type="checkbox"
          data-action="toggle-bookmark-selection"
          data-id="${bookmark.id}"
          aria-checked="${appState.selectedBookmarkIds.has(bookmark.id) ? 'true' : 'false'}"
          ${appState.selectedBookmarkIds.has(bookmark.id) ? 'checked' : ''}
        />
        <span class="tree-icon-slot" aria-hidden="true"></span>
        <button class="tree-main tree-main--bookmark" data-action="open-reader-bookmark" data-id="${bookmark.id}">
          <span class="tree-label-row">
            <span class="tree-label">${escapeHtml(bookmark.title)}</span>
            <span class="tree-subtitle">${bookmark.platform} · ${new Date(bookmark.timestamp).toLocaleDateString()}</span>
          </span>
        </button>
        <div class="tree-actions">
          <button class="icon-btn" data-action="bookmark-row-action" data-op="open" data-id="${bookmark.id}" aria-label="Open conversation">${icon(sharedExternalLinkIcon)}</button>
          <button class="icon-btn" data-action="bookmark-row-action" data-op="copy" data-id="${bookmark.id}" aria-label="Copy bookmark markdown">${icon(sharedCopyIcon)}</button>
          <button class="icon-btn icon-btn--danger" data-action="bookmark-row-action" data-op="delete" data-id="${bookmark.id}" aria-label="Delete bookmark">${icon(sharedTrashIcon)}</button>
        </div>
      </div>
    `;
}

function getBookmarksPanelHtml(): string {
    const selectedCount = appState.selectedBookmarkIds.size;
    const nodesHtml = getVisibleRootNodes().map((node) => renderFolderNode(node, 0)).join('');

    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--bookmarks">
          <div class="panel-header">
            <div class="panel-header__meta">
              <h2>${appState.bookmarksTab === 'bookmarks' ? 'Bookmarks' : appState.bookmarksTab === 'settings' ? 'Settings' : 'Sponsor'}</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(sharedXIcon)}</button>
            </div>
          </div>
          <div class="bookmarks-shell">
            <nav class="bookmarks-sidebar">
              <button class="tab-btn" data-action="set-bookmarks-tab" data-tab="bookmarks" data-active="${appState.bookmarksTab === 'bookmarks' ? '1' : '0'}">${icon(sharedBookmarkIcon)}<span>Bookmarks</span></button>
              <button class="tab-btn" data-action="set-bookmarks-tab" data-tab="settings" data-active="${appState.bookmarksTab === 'settings' ? '1' : '0'}">${icon(sharedSettingsIcon)}<span>Settings</span></button>
              <button class="tab-btn" data-action="set-bookmarks-tab" data-tab="sponsor" data-active="${appState.bookmarksTab === 'sponsor' ? '1' : '0'}">${icon(sharedCoffeeIcon)}<span>Sponsor</span></button>
            </nav>
            <div class="bookmarks-body">
              <section class="tab-panel tab-panel--bookmarks" data-active="${appState.bookmarksTab === 'bookmarks' ? '1' : '0'}">
                <div class="toolbar-row toolbar-row--bookmarks">
                  <div class="search-field">
                    ${icon(sharedSearchIcon)}
                    <input data-role="bookmark-query" value="${escapeHtml(appState.query)}" placeholder="Search bookmarks" />
                  </div>
                  ${getPlatformDropdownHtml()}
                  <div class="toolbar-actions">
                    <button class="icon-btn" data-action="toggle-sort-time" data-active="${appState.sortMode.startsWith('time') ? '1' : '0'}" aria-label="Sort by time">${icon(appState.sortMode === 'time-asc' ? sharedSortTimeAscIcon : sharedSortTimeIcon)}</button>
                    <button class="icon-btn" data-action="toggle-sort-alpha" data-active="${appState.sortMode.startsWith('alpha') ? '1' : '0'}" aria-label="Sort alphabetically">${icon(appState.sortMode === 'alpha-asc' ? sharedSortAlphaAscIcon : sharedSortAZIcon)}</button>
                    <button class="icon-btn" data-action="bookmarks-top-action" data-op="create-folder" aria-label="Create folder">${icon(sharedFolderPlusIcon)}</button>
                    <button class="icon-btn" data-action="bookmarks-top-action" data-op="import" aria-label="Import bookmarks">${icon(sharedUploadIcon)}</button>
                    <button class="icon-btn" data-action="bookmarks-top-action" data-op="export-all" aria-label="Export all bookmarks">${icon(sharedDownloadIcon)}</button>
                  </div>
                </div>
                <div class="tree-panel">
                  ${nodesHtml || `
                    <div class="empty-state">
                      <div class="empty-icon">${icon(sharedFolderIcon)}</div>
                      <strong>${appState.query || appState.platform !== 'All' ? 'No bookmarks match the current filters' : 'No folders yet'}</strong>
                      <p>${appState.query || appState.platform !== 'All' ? 'Clear the active filters or select a broader folder scope.' : 'Create a folder or import bookmarks to start browsing saved messages.'}</p>
                      <div class="empty-actions">
                        <button class="${buttonClass('primary')}" data-action="bookmarks-top-action" data-op="create-folder">${appState.query || appState.platform !== 'All' ? 'Create folder anyway' : 'Create first folder'}</button>
                        <button class="${buttonClass('secondary')}" data-action="bookmarks-top-action" data-op="import">Import bookmarks</button>
                      </div>
                    </div>
                  `}
                </div>
                <div class="batch-bar" data-active="${selectedCount > 0 ? '1' : '0'}" aria-hidden="${selectedCount > 0 ? 'false' : 'true'}">
                  <div class="batch-label">${selectedCount > 0 ? `${selectedCount} selected` : ''}</div>
                  <div class="batch-actions">
                    <button class="icon-btn" data-action="batch-clear" aria-label="Clear selection" ${selectedCount === 0 ? 'disabled' : ''}>${icon(sharedXIcon)}</button>
                    <button class="icon-btn" data-action="batch-move" aria-label="Move selected" ${selectedCount === 0 ? 'disabled' : ''}>${icon(sharedMoveIcon)}</button>
                    <button class="icon-btn icon-btn--danger" data-action="batch-delete" aria-label="Delete selected" ${selectedCount === 0 ? 'disabled' : ''}>${icon(sharedTrashIcon)}</button>
                    <button class="icon-btn" data-action="batch-export" aria-label="Export selected" ${selectedCount === 0 ? 'disabled' : ''}>${icon(sharedDownloadIcon)}</button>
                  </div>
                </div>
              </section>
              <section class="tab-panel settings-panel" data-active="${appState.bookmarksTab === 'settings' ? '1' : '0'}">
                ${getSettingsTabHtml()}
              </section>
              <section class="tab-panel sponsor-panel" data-active="${appState.bookmarksTab === 'sponsor' ? '1' : '0'}">
                ${getSponsorTabHtml()}
              </section>
            </div>
          </div>
        </div>
      </div>
    `;
}

function getSettingsTabHtml(): string {
    const s = appState.settings;
    return `
      <div class="settings-grid">
        <section class="settings-card">
          <div class="card-title">${icon(globeIcon)} Platforms</div>
          ${renderToggle('settings-platform-chatgpt', 'ChatGPT', s.platforms.chatgpt, 'Enable AI-MarkDone on ChatGPT.')}
          ${renderToggle('settings-platform-gemini', 'Gemini', s.platforms.gemini, 'Enable AI-MarkDone on Gemini.')}
          ${renderToggle('settings-platform-claude', 'Claude', s.platforms.claude, 'Enable AI-MarkDone on Claude.')}
          ${renderToggle('settings-platform-deepseek', 'DeepSeek', s.platforms.deepseek, 'Enable AI-MarkDone on DeepSeek.')}
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(sharedChatgptIcon)} ChatGPT</div>
          <div class="settings-row">
            <div class="settings-label">
              <strong>Folding mode</strong>
              <p>Controls how many messages stay expanded by default.</p>
            </div>
            ${renderSettingsSelect('folding-mode')}
          </div>
          <div class="settings-row" data-visible="${s.chatgpt.foldingMode === 'keep_last_n' ? '1' : '0'}">
            <div class="settings-label">
              <strong>Expanded count</strong>
              <p>Used only when the folding mode keeps the latest N messages visible.</p>
            </div>
            <div class="settings-number-field">
              <input class="settings-number" data-role="settings-folding-count" type="number" min="0" value="${s.chatgpt.defaultExpandedCount}" />
              <div class="settings-number-stepper">
                <button class="settings-number-step" type="button" data-action="settings-step-count" data-direction="up" aria-label="Increase expanded count">${icon(sharedChevronDownIcon)}</button>
                <button class="settings-number-step settings-number-step--down" type="button" data-action="settings-step-count" data-direction="down" aria-label="Decrease expanded count">${icon(sharedChevronDownIcon)}</button>
              </div>
            </div>
          </div>
          ${renderToggle('settings-fold-dock', 'Show fold dock', s.chatgpt.showFoldDock, 'Keep the compact fold dock visible in supported threads.')}
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(settingsIcon)} Behavior</div>
          ${renderToggle('settings-show-view-source', 'Show View Source', s.behavior.showViewSource, 'Show the View Source action in supported toolbars and panels.')}
          ${renderToggle('settings-show-save-messages', 'Show Save Messages', s.behavior.showSaveMessages, 'Show the Save Messages action where export is supported.')}
          ${renderToggle('settings-show-word-count', 'Show Word Count', s.behavior.showWordCount, 'Display word count information for saved and rendered content.')}
          ${renderToggle('settings-click-to-copy', 'Enable click-to-copy', s.behavior.enableClickToCopy, 'Copy message content directly when supported surfaces are clicked.')}
          ${renderToggle('settings-save-context-only', 'Save context only', s.behavior.saveContextOnly, 'Only save the conversation context instead of the full thread when exporting or bookmarking.')}
          ${renderToggle('settings-render-code-reader', 'Render code in Reader', s.reader.renderCodeInReader, 'Render fenced code blocks with reader formatting instead of raw plain text.')}
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(languagesIcon)} Language</div>
          <div class="settings-row">
            <div class="settings-label">
              <strong>Interface language</strong>
              <p>Auto follows the browser, or pin the UI to a specific locale.</p>
            </div>
            ${renderSettingsSelect('language')}
          </div>
        </section>
        <section class="settings-card">
          <div class="card-title">${icon(databaseIcon)} Data & storage</div>
          <div class="storage-header">
            <strong>Storage used</strong>
            <span>${settingsStoragePercent()}%</span>
          </div>
          <div class="storage-track"><div class="storage-fill" style="width:${settingsStoragePercent()}%"></div></div>
          <div class="backup-callout">
            <div>
              <strong>Backup your bookmarks</strong>
              <p>Export everything before major refactors or browser reinstalls.</p>
            </div>
            <button class="${buttonClass('secondary')}" data-action="settings-export-backup">${icon(downloadIcon)} Export all</button>
          </div>
        </section>
      </div>
    `;
}

function renderToggle(role: string, label: string, checked: boolean, desc = ''): string {
    return `
      <label class="toggle-row">
        <div class="settings-label">
          <strong>${escapeHtml(label)}</strong>
          ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
        </div>
        <span class="toggle-switch" data-checked="${checked ? '1' : '0'}">
          <input type="checkbox" data-role="${role}" ${checked ? 'checked' : ''} />
          <span class="toggle-knob"></span>
        </span>
      </label>
    `;
}

function getSponsorTabHtml(): string {
    return `
      <div class="sponsor-celebration" aria-hidden="true"></div>
      <div class="sponsor-shell">
        <div class="sponsor-title-row">
          <img class="sponsor-brand-mark" src="/icons/icon128.png" alt="AI-MarkDone" />
        </div>

        <section class="sponsor-card sponsor-card--primary">
          <div class="sponsor-section-head">
            <div class="sponsor-section-icon">${icon(githubIcon)}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">Open source support</div>
              <div class="sponsor-section-note">Star the repository to help the project stay visible.</div>
            </div>
          </div>
          <p>If the project is useful, starring the repository is the fastest way to help. It improves discoverability and makes continued maintenance easier to justify.</p>
          <div class="sponsor-action-row">
            <button class="${buttonClass('primary')} sponsor-cta-button" data-action="sponsor-github">${icon(githubIcon)} Star on GitHub</button>
          </div>
        </section>

        <section class="sponsor-card sponsor-card--secondary">
          <div class="sponsor-section-head sponsor-section-head--centered">
            <div class="sponsor-section-icon sponsor-section-icon--warm">${icon(coffeeIcon)}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">Donate</div>
              <div class="sponsor-section-note">Support development directly with the existing sponsor channels.</div>
            </div>
          </div>
          <p>If AI-MarkDone saves you time, you can also support development directly through the same two channels used in the shipped sponsor tab.</p>
          <div class="sponsor-qr-grid">
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>Buy Me a Coffee</strong>
                <span>Quick international support</span>
              </div>
              <div class="sponsor-qr-frame">
                <img class="sponsor-qr-image" src="/icons/bmc_qr.png" alt="Buy Me a Coffee QR code" />
              </div>
            </article>
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>WeChat reward</strong>
                <span>Direct appreciation in WeChat</span>
              </div>
              <div class="sponsor-qr-frame">
                <img class="sponsor-qr-image" src="/icons/wechat_qr.png" alt="WeChat appreciation code" />
              </div>
            </article>
          </div>
        </section>
      </div>
    `;
}

function getReaderPanelHtml(): string {
    const items = getVisibleBookmarksForReader();
    const item = items[appState.readerIndex] || items[0];
    if (!item) {
        return `
          <div class="panel-stage__overlay">
            <div class="panel-window panel-window--dialog">
              <div class="panel-header">
                <div class="panel-header__meta">
                  <div class="panel-kicker">Reader panel</div>
                  <h2>No readable bookmarks</h2>
                </div>
                <div class="panel-header__actions">
                  <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
                </div>
              </div>
              <div class="dialog-body dialog-body--centered">
                <p>Open a bookmark from the Bookmarks tab to preview it inside the reader.</p>
              </div>
            </div>
          </div>
        `;
    }

    const dots = items.map((_, index) => `
      <button class="reader-dot ${index === appState.readerIndex ? 'reader-dot--active' : ''}" data-action="reader-jump" data-index="${index}" aria-label="Go to page ${index + 1}"></button>
    `).join('');
    const readerHtml = getReaderRenderedHtml(item);

    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--reader" data-fullscreen="${appState.readerFullscreen ? '1' : '0'}">
          <div class="panel-header">
            <div class="panel-header__meta panel-header__meta--reader">
              <h2>Reader panel</h2>
              <div class="reader-header-page">${appState.readerIndex + 1}/${items.length}</div>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="reader-open-conversation" aria-label="Open conversation">${icon(sharedExternalLinkIcon)}</button>
              <button class="icon-btn" data-action="reader-copy" aria-label="Copy markdown">${icon(sharedCopyIcon)}</button>
              <button class="icon-btn" data-action="reader-source" aria-label="View source">${icon(sharedFileCodeIcon)}</button>
              <button class="icon-btn" data-action="reader-fullscreen" aria-label="Toggle fullscreen">${icon(appState.readerFullscreen ? sharedMinimizeIcon : sharedMaximizeIcon)}</button>
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(sharedXIcon)}</button>
            </div>
          </div>
          <div class="reader-body">
            <article class="reader-content">
              <div class="reader-thread">
                <section class="reader-message reader-message--user">
                  <div class="reader-message__label">User message</div>
                  <div class="reader-message__body reader-message__body--prompt">${escapeHtml(item.userPrompt)}</div>
                </section>
                <section class="reader-message reader-message--assistant">
                  <div class="reader-message__label">AI response</div>
                  <div class="reader-markdown">${readerHtml}</div>
                </section>
              </div>
            </article>
          </div>
          <div class="reader-footer">
            <div class="reader-footer__left">
              <button class="icon-btn icon-btn--reader-tool" data-action="reader-send-toggle" aria-label="Open send popover" data-active="${appState.readerSendPopoverOpen ? '1' : '0'}">${icon(sendIcon)}</button>
              <button class="icon-btn icon-btn--reader-tool" data-action="reader-locate" aria-label="Locate original message">${icon(locateIcon)}</button>
              ${appState.readerSendPopoverOpen ? getInlineSendPopoverHtml('reader') : ''}
            </div>
            <div class="reader-footer__center">
              <button class="nav-btn nav-btn--reader" data-action="reader-prev" ${appState.readerIndex === 0 ? 'disabled' : ''}>${icon(chevronRightIcon)}</button>
              <div class="reader-dots">${dots}</div>
              <button class="nav-btn nav-btn--next nav-btn--reader" data-action="reader-next" ${appState.readerIndex >= items.length - 1 ? 'disabled' : ''}>${icon(chevronRightIcon)}</button>
            </div>
            <div class="reader-footer__meta">
              <div class="hint">${items.length > 1 ? 'Use <- / -> to switch pages.' : ''}</div>
              <div class="status-line">${escapeHtml(appState.readerStatus || '')}</div>
            </div>
          </div>
        </div>
      </div>
    `;
}

function currentSourceContent(): string {
    const bookmark = currentReaderBookmark();
    return bookmark ? getReaderAssistantMarkdown(bookmark) : 'No source selected.';
}

function getSourcePanelHtml(): string {
    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--source">
          <div class="panel-header">
            <div class="panel-header__meta panel-header__meta--reader">
              <h2>Source</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="source-copy" aria-label="Copy source">${icon(copyIcon)}</button>
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
            </div>
          </div>
          <div class="source-body">
            <pre class="source-pre">${escapeHtml(currentSourceContent())}</pre>
          </div>
        </div>
      </div>
    `;
}

function getSaveMessagesDialogHtml(): string {
    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--dialog panel-window--save">
          <div class="panel-header">
            <div class="panel-header__meta">
              <h2>Save Messages</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
            </div>
          </div>
          <div class="dialog-body">
            <div class="section-label">Select messages</div>
            <div class="message-grid">
              ${conversationTurns.map((turn, index) => `
                <button class="message-chip" data-action="toggle-turn" data-index="${index}" data-active="${appState.selectedTurns.has(index) ? '1' : '0'}" title="${escapeHtml(turn.user)}">${index + 1}</button>
              `).join('')}
            </div>
            <div class="section-label">Format</div>
            <div class="segmented">
              <button data-action="set-format" data-format="markdown" data-active="${appState.saveFormat === 'markdown' ? '1' : '0'}">${icon(fileCodeIcon)}<span>Markdown</span></button>
              <button data-action="set-format" data-format="pdf" data-active="${appState.saveFormat === 'pdf' ? '1' : '0'}">${icon(fileTextIcon)}<span>PDF</span></button>
            </div>
          </div>
          <div class="panel-footer panel-footer--between">
            <div class="button-row">
              <button class="${buttonClass('secondary')}" data-action="select-all-turns">Select all</button>
              <button class="${buttonClass('ghost')}" data-action="deselect-all-turns">Deselect all</button>
            </div>
            <div class="footer-cluster">
              <div class="counter">${appState.selectedTurns.size}/${conversationTurns.length} selected</div>
              <button class="${buttonClass('primary')}" data-action="save-turns" ${appState.selectedTurns.size === 0 ? 'disabled' : ''}>Save</button>
            </div>
          </div>
        </div>
      </div>
    `;
}

function renderBookmarkSaveFolderNode(node: FolderNode, depth: number): string {
    const expanded = appState.bookmarkSaveExpandedPaths.has(node.path);
    const hasChildren = node.children.length > 0;
    const selected = appState.bookmarkSaveSelectedFolderPath === node.path;
    return `
      <div class="picker-node">
        <div class="picker-row" data-action="bookmark-save-toggle-folder" data-path="${node.path}" data-selected="${selected ? '1' : '0'}" style="--depth:${depth};">
          <button class="tree-caret" data-action="bookmark-save-toggle-folder" data-path="${node.path}" ${hasChildren ? '' : 'disabled'}>${hasChildren ? icon(expanded ? chevronDownIcon : chevronRightIcon) : ''}</button>
          <button class="picker-main" data-action="bookmark-save-select-folder" data-path="${node.path}">
            <span class="tree-folder-icon">${icon(expanded ? folderOpenIcon : folderIcon)}</span>
            <span class="tree-label">${node.name}</span>
          </button>
          <button class="icon-btn" data-action="bookmark-save-inline-folder" data-path="${node.path}" aria-label="Create subfolder">${icon(folderPlusIcon)}</button>
          <span class="picker-check">${selected ? icon(checkIcon) : ''}</span>
        </div>
        ${appState.bookmarkSaveInlineParentPath === node.path ? `
          <div class="inline-editor" style="--depth:${depth + 1};">
            <input data-role="bookmark-save-inline-draft" value="${escapeHtml(appState.bookmarkSaveInlineDraft)}" placeholder="New subfolder" />
            <button class="icon-btn" data-action="bookmark-save-inline-confirm" aria-label="Save subfolder">${icon(checkIcon)}</button>
            <button class="icon-btn" data-action="bookmark-save-inline-cancel" aria-label="Cancel">${icon(xIcon)}</button>
          </div>
        ` : ''}
        <div class="tree-children" data-expanded="${expanded ? '1' : '0'}">
          ${node.children.map((child) => renderBookmarkSaveFolderNode(child, depth + 1)).join('')}
        </div>
      </div>
    `;
}

function getBookmarkSaveDialogHtml(): string {
    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--dialog panel-window--bookmark-save">
          <div class="panel-header">
            <div class="panel-header__meta panel-header__meta--reader">
              <h2>Save Bookmark</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
            </div>
          </div>
          <div class="dialog-body dialog-body--bookmark-save">
            <div class="field-block">
              <label class="field-label">Title</label>
              <input class="text-input text-input--bookmark-save-title" type="text" data-role="bookmark-save-title" value="${escapeHtml(appState.bookmarkSaveTitle)}" placeholder="Enter bookmark title" />
            </div>
            <div class="field-block">
              <div class="field-head">
                <label class="field-label">Folder</label>
                <button class="icon-btn" data-action="bookmark-save-new-root-folder" aria-label="Create root folder">${icon(folderPlusIcon)}</button>
              </div>
              <div class="picker-tree">
                ${folderTree.map((node) => renderBookmarkSaveFolderNode(node, 0)).join('')}
              </div>
            </div>
          </div>
          <div class="panel-footer panel-footer--bookmark-save">
            <div class="button-row">
              <button class="${buttonClass('secondary')}" data-action="close-panel">Cancel</button>
              <button class="${buttonClass('primary')}" data-action="bookmark-save-submit" ${(!appState.bookmarkSaveTitle.trim() || !appState.bookmarkSaveSelectedFolderPath) ? 'disabled' : ''}>Save</button>
            </div>
          </div>
        </div>
      </div>
    `;
}

function getInlineSendPopoverHtml(mode: 'sandbox' | 'reader' | 'standalone'): string {
    const popoverStyle = `style="width:${appState.sendPopoverWidth}px;height:${appState.sendPopoverHeight}px;"`;
    return `
      <div class="send-popover ${mode === 'standalone' ? 'send-popover--standalone' : ''}" ${popoverStyle}>
        <div class="send-popover__head">
          <strong>Send</strong>
          <div class="send-popover__head-actions">
            <button class="icon-btn" data-action="${mode === 'reader' ? 'reader-send-toggle' : 'toggle-send-popover'}" aria-label="Close send popover">${icon(xIcon)}</button>
          </div>
        </div>
        <button class="icon-btn send-popover__resize-handle" data-action="send-popover-resize" aria-label="Resize send popover" title="Drag to resize">
          <span class="send-popover__resize-grip" aria-hidden="true"></span>
        </button>
        <textarea class="send-popover__input" data-role="send-draft" rows="5" placeholder="Type your message">${escapeHtml(appState.sendDraft)}</textarea>
        <div class="send-popover__foot">
          <div class="status-line">${escapeHtml(appState.sendStatus || '')}</div>
          <div class="button-row">
            <button class="${buttonClass('ghost')}" data-action="${mode === 'reader' ? 'reader-send-toggle' : 'toggle-send-popover'}">Cancel</button>
            <button class="${buttonClass('primary')}" data-action="send-submit">${icon(sendIcon)} Send</button>
          </div>
        </div>
      </div>
    `;
}

function getSendPopoverPanelHtml(): string {
    const anchorWidth = Math.max(420, Math.min(680, appState.sendPopoverWidth + 60));
    const anchorMinHeight = Math.max(190, appState.sendPopoverHeight + 110);
    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--dialog panel-window--popover-demo">
          <div class="panel-header">
            <div class="panel-header__meta">
              <div class="panel-kicker">Send popover</div>
              <h2>Anchored quick composer</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
            </div>
          </div>
          <div class="dialog-body dialog-body--centered">
            <div class="popover-demo-anchor" style="width:${anchorWidth}px;min-height:${anchorMinHeight}px;">
              <div class="popover-demo-toolbar">
                <button class="icon-btn" data-action="toggle-send-popover" aria-label="Toggle send popover">${icon(sendIcon)}</button>
              </div>
              ${appState.sendPopoverOpen ? getInlineSendPopoverHtml('standalone') : '<div class="help-text">Open the send button to inspect the compact popover surface.</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
}

function getDialogsPanelHtml(): string {
    return `
      <div class="panel-stage__overlay">
        <div class="panel-window panel-window--dialog panel-window--dialogs">
          <div class="panel-header">
            <div class="panel-header__meta">
              <h2>System Dialogs</h2>
            </div>
            <div class="panel-header__actions">
              <button class="icon-btn" data-action="close-panel" aria-label="Close panel">${icon(xIcon)}</button>
            </div>
          </div>
          <div class="dialog-body dialog-body--dialogs">
            <div class="dialog-demo-grid">
              <article class="dialog-demo-card">
                <div class="dialog-demo-card__eyebrow">Info</div>
                <h3>Create folder</h3>
                <p>Matches the non-destructive prompts used for creating folders, renaming folders, moving selections, and choosing a target path.</p>
                <ul class="dialog-demo-list">
                  <li>Create folder</li>
                  <li>New subfolder</li>
                  <li>Move selected bookmarks</li>
                </ul>
                <button class="${buttonClass('secondary')}" data-action="open-dialog-preview" data-dialog="info">Open preview</button>
              </article>
              <article class="dialog-demo-card">
                <div class="dialog-demo-card__eyebrow">Warning</div>
                <h3>Delete folder</h3>
                <p>Used for destructive confirms, especially anything that cannot be undone.</p>
                <ul class="dialog-demo-list">
                  <li>Delete folder</li>
                  <li>Delete selected</li>
                  <li>Delete bookmark</li>
                </ul>
                <button class="${buttonClass('secondary')}" data-action="open-dialog-preview" data-dialog="warning">Open preview</button>
              </article>
              <article class="dialog-demo-card">
                <div class="dialog-demo-card__eyebrow">Error</div>
                <h3>Import failed</h3>
                <p>Used when import/export or folder operations fail and the user needs a short, unambiguous recovery message.</p>
                <ul class="dialog-demo-list">
                  <li>Export all failed</li>
                  <li>Import failed</li>
                  <li>Rename folder failed</li>
                </ul>
                <button class="${buttonClass('secondary')}" data-action="open-dialog-preview" data-dialog="error">Open preview</button>
              </article>
              <article class="dialog-demo-card dialog-demo-card--merge">
                <div class="dialog-demo-card__eyebrow">Import merge</div>
                <h3>Import merge review</h3>
                <p>Uses the same shell, but expands the body to show merge decisions, skipped duplicates, renamed titles, quota warnings, and the Save context only option.</p>
                <div class="dialog-demo-meta">
                  ${getImportMergeSummaryItems().map((item) => `
                    <span class="dialog-demo-meta__pill"><strong>${escapeHtml(item.value)}</strong> ${escapeHtml(item.label)}</span>
                  `).join('')}
                </div>
                <button class="${buttonClass('secondary')}" data-action="open-dialog-preview" data-dialog="import-merge">Open preview</button>
              </article>
            </div>
          </div>
        </div>
      </div>
    `;
}

function getActivePanelHtml(): string {
    switch (appState.activePanel) {
        case 'bookmarks':
            return getBookmarksPanelHtml();
        case 'reader':
            return getReaderPanelHtml();
        case 'source':
            return getSourcePanelHtml();
        case 'saveMessages':
            return getSaveMessagesDialogHtml();
        case 'bookmarkSave':
            return getBookmarkSaveDialogHtml();
        case 'sendPopover':
            return getSendPopoverPanelHtml();
        case 'dialogs':
            return getDialogsPanelHtml();
        default:
            return `
              <div class="panel-stage__empty">
                <strong>Select a panel mock</strong>
                <p>Use the launcher cards above to inspect each surface in isolation.</p>
              </div>
            `;
    }
}

function getModalHtml(): string {
    const modal = appState.modal;
    if (!modal) return '';
    return `
      <div class="mock-modal-overlay">
        <div class="mock-modal" data-kind="${modal.kind}">
          <div class="mock-modal__head">
            <div class="mock-modal__title-wrap">
              <span class="mock-modal__kind-icon">${modalKindIcon(modal.kind)}</span>
              <div class="mock-modal__title-copy">
                <strong>${escapeHtml(modal.title)}</strong>
              </div>
            </div>
            <button class="icon-btn" data-action="modal-cancel" aria-label="Close modal">${icon(xIcon)}</button>
          </div>
          <div class="mock-modal__content">
            ${modal.message ? `<p class="mock-modal__message">${escapeHtml(modal.message)}</p>` : ''}
            ${modal.mode === 'prompt' ? `<input class="text-input mock-modal__input" data-role="modal-input" value="${escapeHtml(modal.value)}" />` : ''}
            ${modal.customHtml || ''}
          </div>
          <div class="mock-modal__footer button-row">
            ${modal.mode === 'alert' ? '' : `<button class="${buttonClass('secondary')}" data-action="modal-cancel">${escapeHtml(modal.cancelText || 'Cancel')}</button>`}
            <button class="${buttonClass(modal.danger ? 'danger' : 'primary')}" data-action="modal-confirm">${escapeHtml(modal.confirmText)}</button>
          </div>
        </div>
      </div>
    `;
}

function getStudioHtml(): string {
    return `
      <div class="studio-shell" data-theme="${appState.theme}">
        <section class="studio-hero">
          <div class="studio-hero__top">
            <div>
              <div class="studio-eyebrow">AI-MarkDone mock-first panel studio</div>
              <h1 class="studio-title">All panels, aligned to the current feature contract.</h1>
              <p class="studio-subtitle">These mocks now mirror the real extension surfaces: tree-based bookmarks, task-oriented dialogs, the reader footer seam, and the compact send popover. The goal is visual refinement without inventing new product behavior.</p>
            </div>
            <div class="studio-theme-toggle">
              <button data-action="set-theme" data-theme="light" data-active="${appState.theme === 'light' ? '1' : '0'}">Light</button>
              <button data-action="set-theme" data-theme="dark" data-active="${appState.theme === 'dark' ? '1' : '0'}">Dark</button>
            </div>
          </div>
          <div class="launcher-grid">
            ${launcherButton('bookmarks', 'Bookmarks Panel', 'Tree browser with search, filtering, folder actions, selection, batch actions, settings, and sponsor tabs.')}
            ${launcherButton('reader', 'Reader Panel', 'Markdown reading surface with header actions, source handoff, fullscreen, and footer send/locate seam.')}
            ${launcherButton('source', 'Source Panel', 'Raw markdown viewer with only copy and close controls.')}
            ${launcherButton('saveMessages', 'Save Messages', 'Turn selector dialog with Markdown/PDF segmented format control.')}
            ${launcherButton('bookmarkSave', 'Bookmark Save', 'Title field, folder picker tree, new folder, and inline subfolder creation.')}
            ${launcherButton('sendPopover', 'Send Popover', 'Compact anchored composer with cancel/send and no target switching.')}
            ${launcherButton('dialogs', 'System Dialogs', 'Reusable info, warning, error, and import-merge dialog previews based on the current bookmarks flows.')}
          </div>
        </section>

        <section class="panel-stage">
          ${getActivePanelHtml()}
          ${getModalHtml()}
        </section>
      </div>
    `;
}

function getStudioCss(): string {
    return `
:host {
  display: block;
  color: var(--aimd-text-primary);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
}

button {
  border: none;
  background: none;
}

.studio-shell {
  min-height: 100vh;
  padding: 32px 28px 44px;
  display: grid;
  gap: 24px;
  color: var(--aimd-text-primary);
}

.studio-hero {
  display: grid;
  gap: 18px;
  padding: 28px;
  border-radius: 30px;
  background:
    linear-gradient(140deg, color-mix(in srgb, var(--aimd-bg-primary) 95%, white), color-mix(in srgb, var(--aimd-bg-secondary) 80%, transparent)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent), transparent 46%);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 88%, rgba(255,255,255,0.68));
  box-shadow: 0 32px 96px color-mix(in srgb, #0f172a 12%, transparent);
}

.studio-hero__top {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}

.studio-eyebrow,
.panel-kicker,
.section-label,
.field-label {
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.studio-title {
  margin: 10px 0 8px;
  font-size: clamp(34px, 5vw, 54px);
  line-height: 0.95;
  letter-spacing: -0.05em;
  font-weight: 770;
  max-width: 12ch;
}

.studio-subtitle {
  margin: 0;
  max-width: 72ch;
  color: color-mix(in srgb, var(--aimd-text-secondary) 94%, transparent);
  font-size: 15px;
  line-height: 1.62;
}

.studio-theme-toggle {
  display: inline-flex;
  gap: 8px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-primary) 88%, transparent);
  box-shadow: 0 10px 28px color-mix(in srgb, #0f172a 8%, transparent);
}

.studio-theme-toggle button {
  cursor: pointer;
  border-radius: 999px;
  padding: 10px 14px;
  color: var(--aimd-text-secondary);
}

.studio-theme-toggle button[data-active="1"] {
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  box-shadow: 0 10px 24px color-mix(in srgb, #0f172a 10%, transparent);
}

.launcher-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.launcher-card {
  cursor: pointer;
  display: grid;
  gap: 7px;
  padding: 16px 18px;
  border-radius: 22px;
  background: color-mix(in srgb, var(--aimd-bg-primary) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 84%, transparent);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
  text-align: left;
}

.launcher-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px color-mix(in srgb, #0f172a 10%, transparent);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-default));
}

.launcher-card[data-active="1"] {
  background: linear-gradient(135deg, color-mix(in srgb, var(--aimd-bg-primary) 88%, transparent), color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent));
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 40%, var(--aimd-border-default));
  box-shadow: 0 22px 44px color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent);
}

.launcher-card__title {
  font-weight: 700;
  font-size: 16px;
}

.launcher-card__caption {
  color: var(--aimd-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.workspace-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workspace-card {
  padding: 22px 24px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 84%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 86%, transparent);
  box-shadow: 0 16px 44px color-mix(in srgb, #0f172a 8%, transparent);
}

.workspace-card h2 {
  margin: 0 0 10px;
  font-size: 21px;
  letter-spacing: -0.03em;
}

.workspace-card p {
  margin: 0;
  color: var(--aimd-text-secondary);
  line-height: 1.6;
}

.checklist {
  margin: 14px 0 0;
  padding-left: 18px;
  color: var(--aimd-text-secondary);
  line-height: 1.7;
}

.panel-stage {
  position: relative;
  min-height: 920px;
  border-radius: 34px;
  overflow: hidden;
  background:
    radial-gradient(circle at bottom center, color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent), transparent 30%),
    linear-gradient(180deg, color-mix(in srgb, var(--aimd-bg-secondary) 92%, transparent), color-mix(in srgb, var(--aimd-bg-primary) 86%, transparent));
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 84%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), 0 26px 80px color-mix(in srgb, #0f172a 12%, transparent);
}

.panel-stage__overlay {
  position: absolute;
  inset: 0;
  padding: 28px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--aimd-bg-overlay-heavy) 92%, transparent);
  backdrop-filter: blur(12px);
}

.panel-stage__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  text-align: center;
  color: var(--aimd-text-secondary);
}

.panel-window {
  width: min(1180px, 100%);
  max-height: 100%;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--aimd-bg-primary) 97%, rgba(255,255,255,0.64)), color-mix(in srgb, var(--aimd-bg-primary) 94%, transparent));
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, rgba(255,255,255,0.5));
  border-radius: 30px;
  box-shadow: 0 32px 120px color-mix(in srgb, #0f172a 18%, transparent);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-window--bookmarks {
  width: min(1180px, calc(100vw - 56px));
  height: min(820px, calc(100vh - 56px));
  max-height: calc(100vh - 56px);
}

.panel-window--reader {
  min-height: 720px;
}

.panel-window--reader[data-fullscreen="1"] {
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
}

.panel-window--dialog {
  width: min(760px, 100%);
}

.panel-window--source {
  width: min(900px, 100%);
}

.panel-window--bookmark-save {
  width: min(660px, 100%);
}

.panel-window--popover-demo {
  width: min(820px, calc(100vw - 56px));
}

.panel-window--dialogs {
  width: min(960px, calc(100vw - 56px));
}

.panel-header,
.panel-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
}

.panel-footer {
  border-bottom: none;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
}

.panel-footer--between {
  justify-content: space-between;
}

.panel-footer--bookmark-save {
  justify-content: flex-end;
}

.panel-header__meta,
.field-block {
  display: grid;
  gap: 8px;
}

.panel-header__meta h2,
.card-title {
  margin: 0;
  font-size: 26px;
  letter-spacing: -0.04em;
  font-weight: 720;
}

.panel-header__actions,
.toolbar-actions,
.button-row,
.footer-cluster,
.toolbar-row,
.batch-actions,
.tree-actions,
.send-popover__head,
.send-popover__foot,
.field-head,
.mock-modal__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-row {
  justify-content: space-between;
  flex-wrap: wrap;
}

.toolbar-row--bookmarks {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  padding: 18px 20px 10px;
  position: relative;
  z-index: 3;
}

.aimd-icon,
.aimd-icon svg {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.studio-btn,
.icon-btn,
.chip-btn,
.tab-btn,
.tree-main,
.picker-main,
.nav-btn,
.message-chip,
.segmented button {
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out), color var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.studio-btn {
  cursor: pointer;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--aimd-text-primary);
}

.studio-btn:hover,
.icon-btn:hover,
.chip-btn:hover,
.nav-btn:hover,
.tree-main:hover,
.picker-main:hover,
.message-chip:hover,
.segmented button:hover,
.select-field:hover,
.settings-select:hover,
.text-input:hover,
.send-textarea:hover,
.send-popover__input:hover,
.search-field:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
}

.studio-btn--primary {
  background: var(--aimd-interactive-primary);
  border-color: transparent;
  color: var(--aimd-text-on-primary);
}

.studio-btn--secondary {
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
}

.studio-btn--ghost {
  background: transparent;
}

.studio-btn--tonal {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
  color: var(--aimd-interactive-primary);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 16%, var(--aimd-border-default));
}

.studio-btn--danger,
.icon-btn--danger {
  background: color-mix(in srgb, var(--aimd-color-danger) 9%, transparent);
  color: var(--aimd-color-danger);
}

.icon-btn,
.nav-btn {
  cursor: pointer;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--aimd-text-secondary);
  flex: 0 0 auto;
}

.icon-btn[data-active="1"],
.nav-btn[data-active="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, transparent);
  color: var(--aimd-interactive-primary);
}

.icon-btn[disabled],
.studio-btn[disabled],
.nav-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.chip-btn {
  cursor: pointer;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-primary) 90%, transparent);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.bookmarks-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}

.bookmarks-sidebar {
  display: grid;
  gap: 10px;
  padding: 20px;
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  align-content: start;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 32%, transparent);
}

.tab-btn {
  cursor: pointer;
  width: 100%;
  padding: 14px 16px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--aimd-text-secondary);
  text-align: left;
}

.tab-btn[data-active="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 26%, transparent);
}

.bookmarks-body,
.tab-panel {
  min-height: 0;
  height: 100%;
}

.tab-panel {
  display: none;
}

.tab-panel[data-active="1"] {
  display: flex;
  flex-direction: column;
}

.tab-panel--bookmarks {
  position: relative;
}

.search-field,
.select-field,
.text-input,
.send-textarea,
.send-popover__input,
.settings-select,
.settings-number {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}

.search-field {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.platform-dropdown {
  position: relative;
  flex: 0 0 auto;
}

.platform-dropdown__trigger {
  cursor: pointer;
  width: 220px;
  height: 44px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}

.platform-dropdown__trigger:hover,
.platform-dropdown[data-open="1"] .platform-dropdown__trigger {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
}

.platform-dropdown__value {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.platform-dropdown__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-shell {
  position: relative;
  flex: 0 0 auto;
}

.settings-select-trigger,
.settings-select {
  cursor: pointer;
  width: 220px;
  height: 44px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}

.settings-select-trigger:hover,
.settings-select-shell[data-open="1"] .settings-select-trigger {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
}

.settings-select-trigger__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-trigger__caret {
  display: inline-flex;
  color: var(--aimd-text-secondary);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.settings-select-shell[data-open="1"] .settings-select-trigger__caret {
  transform: rotate(180deg);
}

.settings-select-menu {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: 20;
  min-width: 100%;
  padding: 8px;
  gap: 4px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  box-shadow: var(--aimd-shadow-lg);
}

.settings-select-menu[data-open="1"] {
  display: grid;
}

.settings-select-option {
  width: 100%;
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  text-align: left;
  color: var(--aimd-text-primary);
}

.settings-select-option:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent);
}

.settings-select-option[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
  color: var(--aimd-interactive-primary);
}

.platform-dropdown__caret {
  display: inline-flex;
  color: var(--aimd-text-secondary);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.platform-dropdown[data-open="1"] .platform-dropdown__caret {
  transform: rotate(180deg);
}

.platform-dropdown__menu {
  display: none;
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  z-index: 20;
  min-width: 100%;
  padding: 8px;
  gap: 4px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  box-shadow: var(--aimd-shadow-lg);
}

.platform-dropdown__menu[data-open="1"] {
  display: grid;
}

.platform-dropdown__option {
  width: 100%;
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  text-align: left;
  color: var(--aimd-text-primary);
}

.platform-dropdown__option:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent);
}

.platform-dropdown__option[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
  color: var(--aimd-interactive-primary);
}

.toolbar-actions {
  flex: 0 0 auto;
  flex-wrap: nowrap;
  margin-left: 0;
}

.platform-option-icon,
.platform-option-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.platform-option-icon svg {
  width: 16px;
  height: 16px;
}

.search-field input,
.text-input,
.settings-number,
.send-textarea,
.send-popover__input {
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  outline: none;
}

.select-field {
  cursor: pointer;
  padding: 12px 14px;
}

.batch-bar {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 18px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 58%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--aimd-bg-primary) 94%, rgba(255,255,255,0.6));
  box-shadow: 0 20px 44px color-mix(in srgb, #0f172a 14%, transparent);
  z-index: 2;
  opacity: 0;
  pointer-events: none;
  transform: translateY(18px);
  transition: opacity 220ms var(--aimd-ease-in-out), transform 220ms var(--aimd-ease-in-out);
}

.batch-bar[data-active="1"] {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.batch-label,
.status-line,
.tree-subtitle,
.help-text,
.hint,
.counter,
.mock-modal__message {
  color: var(--aimd-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.tree-panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 20px;
  padding-bottom: 96px;
}

.tree-node {
  display: grid;
}

.tree-item {
  position: relative;
  display: grid;
  grid-template-columns: 20px 18px 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 4px 8px;
  padding-right: 116px;
  padding-left: calc(10px + var(--depth) * 18px);
  border-radius: 14px;
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-item + .tree-item {
  margin-top: 2px;
}

.tree-item:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
}

.tree-item[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
}

.tree-caret,
.tree-check {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-secondary);
  flex: 0 0 auto;
}

.tree-caret,
.tree-caret-slot {
  width: 20px;
  height: 20px;
}

.tree-caret[disabled] {
  opacity: 0.35;
  cursor: default;
}

.tree-check {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  width: 18px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--aimd-text-secondary) 22%, transparent);
  border-radius: 6px;
  background: var(--aimd-surface-primary);
  box-shadow: var(--aimd-shadow-xs);
  display: grid;
  place-items: center;
  justify-self: center;
  transition: border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-check::before {
  content: '';
  width: 9px;
  height: 5px;
  border-left: 2px solid transparent;
  border-bottom: 2px solid transparent;
  transform: translateY(-1px) rotate(-45deg) scale(0);
  transform-origin: center;
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-check:hover {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 40%, var(--aimd-border-primary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 10%, transparent);
}

.tree-check:checked {
  border-color: var(--aimd-interactive-primary);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 14%, var(--aimd-surface-primary));
}

.tree-check:checked::before {
  border-left-color: var(--aimd-interactive-primary);
  border-bottom-color: var(--aimd-interactive-primary);
  transform: translateY(-1px) rotate(-45deg) scale(1);
}

.tree-check:focus-visible {
  outline: none;
  border-color: var(--aimd-interactive-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aimd-interactive-primary) 16%, transparent);
}

.tree-check[data-indeterminate="1"]::before {
  width: 8px;
  height: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--aimd-interactive-primary);
  transform: scale(1);
}

.tree-caret-slot,
.tree-icon-slot {
  display: inline-flex;
  width: 20px;
  height: 20px;
}

.tree-main,
.picker-main {
  cursor: pointer;
  min-width: 0;
  width: 100%;
  padding: 6px 0;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  justify-self: stretch;
}

.tree-main--bookmark {
  padding-left: 0;
}

.tree-label-row {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.45;
}

.tree-subtitle {
  font-size: 12px;
  line-height: 1.4;
}

.tree-folder-icon,
.picker-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.tree-count {
  min-width: 18px;
  justify-self: end;
  text-align: right;
  font-size: 12px;
  color: var(--aimd-text-secondary);
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.tree-actions {
  position: absolute;
  top: 50%;
  right: 8px;
  opacity: 0;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
  transform: translateY(-50%) translateX(6px);
}

.tree-item:hover .tree-actions,
.tree-item:focus-within .tree-actions,
.tree-item[data-selected="1"] .tree-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0);
}

.tree-item:hover .tree-count,
.tree-item:focus-within .tree-count,
.tree-item[data-selected="1"] .tree-count {
  opacity: 0;
  pointer-events: none;
}

.tree-children {
  display: none;
}

.tree-children[data-expanded="1"] {
  display: grid;
}

.empty-state,
.dialog-body--centered {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
  min-height: 320px;
}

.empty-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 82%, transparent);
  color: var(--aimd-text-secondary);
}

.empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.settings-panel,
.sponsor-panel {
  padding: 20px;
  overflow: auto;
}

.settings-grid,
.sponsor-grid {
  display: grid;
  gap: 16px;
}

.sponsor-panel {
  display: block;
  position: relative;
  overflow: auto;
  padding-top: 18px;
}

.sponsor-shell {
  position: relative;
  width: min(620px, calc(100% - 40px));
  margin: 0 auto;
  display: grid;
  gap: 16px;
  padding: 0 0 18px;
}

.sponsor-celebration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: 28px;
  z-index: 4;
}

.sponsor-burst-piece {
  position: absolute;
  width: 9px;
  height: 16px;
  border-radius: 999px;
  background: var(--piece-color, var(--aimd-interactive-primary));
  transform: translate(-50%, -50%) rotate(var(--piece-rotate, 0deg));
  opacity: 0;
  animation: sponsor-burst 900ms var(--aimd-ease-out) forwards;
}

@keyframes sponsor-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(var(--piece-rotate, 0deg)) scale(0.45);
  }
  100% {
    opacity: 0;
    transform:
      translate(
        calc(-50% + var(--piece-x, 0px)),
        calc(-50% + var(--piece-y, 0px))
      )
      rotate(calc(var(--piece-rotate, 0deg) + 180deg))
      scale(1);
  }
}

.sponsor-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sponsor-brand-mark {
  width: 56px;
  height: 56px;
  flex: none;
}

.settings-card,
.sponsor-card,
.qr-card,
.mock-modal {
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 90%, transparent);
  box-shadow: none;
}

.settings-card,
.sponsor-card {
  padding: 18px;
  display: grid;
  gap: 14px;
}

.sponsor-card {
  padding: 24px;
  border-radius: 24px;
  justify-items: center;
  text-align: center;
}

.sponsor-card--primary {
  background: var(--aimd-bg-primary);
}

.sponsor-card--secondary {
  background: var(--aimd-bg-primary);
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  font-size: 16px;
  font-weight: 400;
}

.sponsor-section-head {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: 12px;
}

.sponsor-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-primary);
}

.sponsor-section-icon .aimd-icon,
.sponsor-section-icon .aimd-icon svg {
  width: 28px;
  height: 28px;
}

.sponsor-section-copy {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.sponsor-section-label {
  font-size: 19px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--aimd-text-primary);
}

.sponsor-section-note {
  max-width: 32ch;
  font-size: 14px;
  line-height: 1.5;
  color: var(--aimd-text-secondary);
}

.sponsor-action-row {
  display: flex;
  justify-content: center;
}

.sponsor-cta-button {
  min-width: 220px;
  min-height: 42px;
  padding-inline: 18px;
  font-size: 16px;
  justify-content: center;
}

.toggle-row,
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 0;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 46%, transparent);
}

.settings-card > .card-title + .toggle-row,
.settings-card > .card-title + .settings-row {
  border-top: none;
}

.toggle-row p,
.settings-row p,
.backup-callout p,
.sponsor-card p {
  margin: 4px 0 0;
  color: var(--aimd-text-secondary);
  font-size: 16px;
  line-height: 1.6;
}

.settings-label strong {
  display: block;
  font-weight: 400;
  font-size: 17px;
  line-height: 1.45;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-border-default) 90%, transparent);
  padding: 3px;
}

.settings-number-field {
  width: 220px;
  height: 44px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
  overflow: hidden;
}

.settings-number-field:hover,
.settings-number-field:focus-within {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 28%, var(--aimd-border-default));
}

.settings-number {
  height: 100%;
  padding: 0 14px;
}

.settings-number::-webkit-outer-spin-button,
.settings-number::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.settings-number-stepper {
  width: 38px;
  border-left: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  display: grid;
  grid-template-rows: 1fr 1fr;
}

.settings-number-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--aimd-text-secondary);
}

.settings-number-step + .settings-number-step {
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.settings-number-step:hover {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent);
}

.settings-number-step .aimd-icon svg {
  transform: rotate(180deg);
}

.settings-number-step--down .aimd-icon svg {
  transform: none;
}

.toggle-switch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.toggle-switch[data-checked="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 70%, transparent);
}

.toggle-knob {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: white;
  box-shadow: 0 2px 10px color-mix(in srgb, #0f172a 18%, transparent);
  transform: translateX(0);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.toggle-switch[data-checked="1"] .toggle-knob {
  transform: translateX(20px);
}

.storage-header,
.backup-callout,
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.storage-track {
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, transparent);
}

.storage-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--aimd-interactive-primary), color-mix(in srgb, var(--aimd-interactive-primary) 74%, white));
}

.sponsor-qr-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}

.sponsor-qr-card {
  padding: 16px;
  display: grid;
  gap: 14px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 88%, transparent);
}

.sponsor-qr-meta {
  display: grid;
  gap: 4px;
  justify-items: center;
}

.sponsor-qr-meta strong {
  font-size: 16px;
  font-weight: 400;
}

.sponsor-qr-meta span {
  color: var(--aimd-text-secondary);
  font-size: 16px;
  line-height: 1.6;
}

.sponsor-qr-frame {
  aspect-ratio: 1;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 76%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--aimd-bg-secondary) 72%, transparent), color-mix(in srgb, var(--aimd-bg-primary) 88%, transparent));
  display: grid;
  place-items: center;
}

.sponsor-qr-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dialog-body {
  padding: 22px;
  display: grid;
  gap: 16px;
}

.dialog-body--bookmark-save {
  gap: 18px;
}

.message-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.message-chip {
  cursor: pointer;
  min-width: 38px;
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.message-chip[data-active="1"],
.segmented button[data-active="1"] {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  border-color: transparent;
}

.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.segmented button {
  cursor: pointer;
  min-height: 42px;
  padding: 0 14px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.segmented button:last-child {
  border-right: none;
}

.reader-body {
  flex: 1;
  overflow: auto;
  padding: 26px 28px 20px;
}

.reader-content {
  max-width: min(1000px, 100%);
  margin: 0 auto;
}

.reader-thread {
  display: grid;
  gap: 18px;
}

.reader-message {
  display: grid;
  gap: 14px;
  padding: 24px 28px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 68%, transparent);
}

.reader-message--assistant {
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, var(--aimd-bg-secondary));
}

.reader-message__label {
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.reader-message__body--prompt {
  font-size: 17px;
  line-height: 1.8;
  color: var(--aimd-text-primary);
}

.reader-markdown {
  min-width: 0;
}

${getMarkdownThemeCss('.reader-markdown')}

.reader-markdown :where(.katex-display) {
  margin: 1em 0;
  padding: 0;
}

.reader-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
  position: relative;
}

.reader-footer__left,
.reader-footer__center {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reader-footer__left {
  position: relative;
}

.reader-footer__center {
  justify-content: center;
  min-width: 0;
}

.reader-footer__meta {
  justify-self: end;
  text-align: right;
  max-width: 220px;
}

.reader-dots {
  display: flex;
  gap: 8px;
  max-width: min(280px, 34vw);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: 2px 0;
}

.reader-dots::-webkit-scrollbar {
  display: none;
}

.reader-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-border-default) 90%, transparent);
  cursor: pointer;
}

.reader-dot--active {
  width: 22px;
  background: var(--aimd-interactive-primary);
}

.panel-header__meta--reader {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-header__meta--reader h2 {
  margin: 0;
}

.reader-header-page {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  line-height: 1.4;
  color: var(--aimd-text-secondary);
}

.icon-btn--reader-tool,
.nav-btn--reader {
  width: 44px;
  height: 44px;
}

.icon-btn--reader-tool .aimd-icon,
.icon-btn--reader-tool .aimd-icon svg,
.nav-btn--reader .aimd-icon,
.nav-btn--reader .aimd-icon svg {
  width: 18px;
  height: 18px;
}

.reader-footer__meta .hint {
  font-size: 13px;
  line-height: 1.45;
}

.nav-btn svg {
  transform: rotate(180deg);
}

.nav-btn--next svg {
  transform: none;
}

.source-body {
  flex: 1;
  min-height: 0;
  padding: 22px;
  overflow: auto;
}

.source-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--aimd-font-family-mono);
  font-size: 14px;
  line-height: 1.7;
  color: var(--aimd-text-primary);
}

.field-block {
  display: grid;
  gap: 12px;
}

.dialog-body--dialogs {
  padding: 22px;
  overflow: auto;
}

.dialog-demo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.dialog-demo-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  box-shadow: 0 14px 30px color-mix(in srgb, #0f172a 8%, transparent);
}

.dialog-demo-card--merge {
  grid-column: span 2;
}

.dialog-demo-card h3 {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
}

.dialog-demo-card p,
.dialog-demo-list {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.dialog-demo-card__eyebrow {
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--aimd-text-secondary);
}

.dialog-demo-list {
  padding-left: 18px;
}

.dialog-demo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dialog-demo-meta__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 92%, transparent);
  font-size: 12px;
  line-height: 1;
}

.text-input--bookmark-save-title {
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 92%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
}

.text-input--bookmark-save-title:focus-within,
.text-input--bookmark-save-title:focus {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-default));
}

.picker-tree {
  max-height: 360px;
  overflow: auto;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  padding: 10px;
  background: color-mix(in srgb, var(--aimd-bg-primary) 88%, transparent);
}

.picker-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 8px;
  padding-left: calc(10px + var(--depth) * 18px);
  border-radius: 14px;
}

.picker-row[data-selected="1"] {
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
}

.inline-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  padding: 8px 8px 8px calc(16px + var(--depth) * 18px);
}

.inline-editor input {
  min-width: 0;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  padding: 10px 12px;
}

.send-textarea {
  min-height: 210px;
  resize: vertical;
}

.send-popover {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  padding: 14px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, rgba(255,255,255,0.72));
  box-shadow: 0 24px 60px color-mix(in srgb, #0f172a 18%, transparent);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 320px;
  min-height: 220px;
  max-width: min(680px, calc(100vw - 80px));
  max-height: min(520px, calc(100vh - 120px));
  overflow: hidden;
}

.send-popover--standalone {
  position: absolute;
  left: 30px;
  top: 30px;
  bottom: auto;
  max-width: none;
}

.send-popover::after {
  content: '';
  position: absolute;
  left: 18px;
  bottom: -7px;
  width: 14px;
  height: 14px;
  transform: rotate(45deg);
  background: inherit;
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
}

.send-popover--standalone::after {
  display: none;
}

.send-popover__head {
  justify-content: space-between;
}

.send-popover__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding-right: 14px;
}

.send-popover__input {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 58%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
  overflow: auto;
  resize: none;
}

.send-popover__foot {
  flex: 0 0 auto;
  justify-content: flex-end;
  align-items: flex-end;
  flex-wrap: wrap;
  row-gap: 10px;
  column-gap: 12px;
  margin-top: auto;
}

.send-popover__foot .status-line {
  flex: 1 1 100%;
}

.send-popover__foot .button-row {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-inline-start: auto;
}

.send-popover__resize-handle {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  cursor: nesw-resize;
  color: color-mix(in srgb, var(--aimd-text-secondary) 88%, transparent);
  z-index: 2;
}

.send-popover__resize-grip {
  position: relative;
  display: block;
  width: 10px;
  height: 10px;
  transform: rotate(-90deg);
  opacity: 0.96;
}

.send-popover__resize-grip::before,
.send-popover__resize-grip::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, transparent 0 40%, currentColor 40% 48%, transparent 48% 60%, currentColor 60% 68%, transparent 68% 80%, currentColor 80% 88%, transparent 88% 100%);
}

.popover-demo-anchor {
  position: relative;
  padding: 30px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 72%, transparent);
  width: min(420px, 100%);
  min-height: 190px;
  overflow: hidden;
}

.panel-window--popover-demo .dialog-body {
  min-height: 420px;
}

.popover-demo-toolbar {
  position: absolute;
  left: 30px;
  bottom: 30px;
  display: flex;
  justify-content: flex-start;
  z-index: 1;
}

.mock-modal-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, #07111c 44%, transparent);
  backdrop-filter: blur(12px);
  z-index: 5;
  padding: 20px;
}

.mock-modal {
  --mock-modal-accent: var(--aimd-interactive-primary);
  --mock-modal-accent-soft: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
  --mock-modal-accent-border: color-mix(in srgb, var(--aimd-interactive-primary) 24%, var(--aimd-border-default));
  width: min(520px, calc(100% - 40px));
  max-width: min(520px, calc(100% - 40px));
  max-height: min(680px, calc(100% - 40px));
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 98%, transparent);
  box-shadow: 0 24px 64px color-mix(in srgb, #0f172a 18%, transparent);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mock-modal[data-kind="info"] {
  --mock-modal-accent: var(--aimd-interactive-primary);
  --mock-modal-accent-soft: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
  --mock-modal-accent-border: color-mix(in srgb, var(--aimd-sys-color-state-info-border) 72%, transparent);
}

.mock-modal[data-kind="warning"] {
  --mock-modal-accent: var(--aimd-color-warning);
  --mock-modal-accent-soft: color-mix(in srgb, var(--aimd-color-warning) 14%, transparent);
  --mock-modal-accent-border: color-mix(in srgb, var(--aimd-color-warning) 26%, var(--aimd-border-default));
}

.mock-modal[data-kind="error"] {
  --mock-modal-accent: var(--aimd-state-error-border);
  --mock-modal-accent-soft: color-mix(in srgb, var(--aimd-state-error-border) 14%, transparent);
  --mock-modal-accent-border: color-mix(in srgb, var(--aimd-state-error-border) 32%, var(--aimd-border-default));
}

.mock-modal__head {
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 90%, transparent);
}

.mock-modal__title-wrap,
.mock-modal__title-copy,
.mock-modal__kind-icon,
.merge-entry__top,
.merge-summary {
  display: flex;
}

.mock-modal__title-wrap {
  align-items: center;
  gap: 12px;
}

.mock-modal__title-copy {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.mock-modal__title-copy strong {
  font-size: 20px;
  line-height: 1.2;
  color: var(--mock-modal-accent);
}

.mock-modal__kind-icon {
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--mock-modal-accent);
  background: var(--mock-modal-accent-soft);
  border: 1px solid var(--mock-modal-accent-border);
}

.mock-modal__content {
  display: grid;
  gap: 14px;
  padding: 20px;
  overflow: auto;
  min-height: 0;
}

.mock-modal__input {
  width: 100%;
}

.mock-modal__message,
.merge-summary-item strong,
.merge-callout strong,
.merge-entry__top strong,
.merge-callout p,
.merge-entry p,
.merge-summary-item__label {
  font-size: 14px;
  line-height: 1.6;
}

.mock-modal__footer {
  justify-content: flex-end;
  padding: 18px 20px;
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 74%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 86%, transparent);
}

.merge-summary {
  flex-wrap: wrap;
  gap: 10px;
}

.merge-summary-item {
  flex: 1 1 120px;
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, transparent);
}

.merge-summary-item__label {
  color: var(--aimd-text-secondary);
}

.merge-callout {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 76%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 92%, transparent);
}

.merge-callout p,
.merge-entry p {
  margin: 0;
  color: var(--aimd-text-secondary);
}

.merge-entry-list {
  display: grid;
  gap: 10px;
}

.merge-entry {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 76%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 96%, transparent);
}

.merge-entry__top {
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.merge-entry-status {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 82%, transparent);
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.merge-entry-status[data-status="duplicate"] {
  color: var(--aimd-text-warning);
  background: color-mix(in srgb, var(--aimd-color-warning) 14%, transparent);
  border-color: color-mix(in srgb, var(--aimd-color-warning) 26%, transparent);
}

.merge-entry-status[data-status="rename"] {
  color: var(--aimd-interactive-primary);
  background: color-mix(in srgb, var(--aimd-interactive-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 26%, transparent);
}

.merge-entry-status[data-status="import"] {
  color: color-mix(in srgb, var(--aimd-interactive-primary) 78%, var(--aimd-text-primary));
  background: color-mix(in srgb, var(--aimd-interactive-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 20%, transparent);
}

.merge-entry-status[data-status="normal"] {
  color: var(--aimd-text-secondary);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 90%, transparent);
}

@media (max-width: 980px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .dialog-demo-grid {
    grid-template-columns: 1fr;
  }

  .dialog-demo-card--merge {
    grid-column: auto;
  }

  .panel-window--bookmarks {
    width: min(1180px, calc(100vw - 28px));
    height: min(820px, calc(100vh - 28px));
    max-height: calc(100vh - 28px);
  }

  .batch-bar {
    left: 14px;
    right: 14px;
    bottom: 14px;
    flex-wrap: wrap;
  }

  .reader-footer {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .reader-footer__meta {
    justify-self: center;
    text-align: center;
  }
}
`;
}

function setStatus(target: 'bookmarkStatus' | 'readerStatus' | 'sourceStatus' | 'saveMessagesStatus' | 'bookmarkSaveStatus' | 'sendStatus', value: string): void {
    appState[target] = value;
}

function measureElementPx(element: HTMLElement | null, property: 'width' | 'height'): number {
    if (!element) return 0;
    const rectValue = property === 'width' ? element.getBoundingClientRect().width : element.getBoundingClientRect().height;
    if (rectValue > 0) return rectValue;
    const computedValue = Number.parseFloat(getComputedStyle(element)[property]);
    return Number.isFinite(computedValue) ? computedValue : 0;
}

function getSendPopoverConstraints(shadow: ShadowRoot): {
    maxWidth: number;
    maxHeight: number;
    anchorWidth: number;
} {
    const panel = shadow.querySelector<HTMLElement>('.panel-window--popover-demo');
    const dialogBody = shadow.querySelector<HTMLElement>('.panel-window--popover-demo .dialog-body');
    const panelWidth = measureElementPx(panel, 'width');
    const panelHeight = measureElementPx(panel, 'height');
    const dialogBodyWidth = measureElementPx(dialogBody, 'width');
    const dialogBodyHeight = measureElementPx(dialogBody, 'height');
    const baseWidth = dialogBodyWidth || panelWidth || DEFAULT_SEND_POPOVER_WIDTH;
    const baseHeight = dialogBodyHeight || panelHeight || DEFAULT_SEND_POPOVER_HEIGHT;

    const maxWidth = Math.max(MIN_SEND_POPOVER_WIDTH, Math.min(MAX_SEND_POPOVER_WIDTH, Math.round(baseWidth - 44)));
    const maxHeight = Math.max(MIN_SEND_POPOVER_HEIGHT, Math.min(MAX_SEND_POPOVER_HEIGHT, Math.round(baseHeight - 44)));
    const anchorLimit = Math.round(dialogBodyWidth || panelWidth || maxWidth + 60);
    const anchorWidth = Math.max(MIN_SEND_POPOVER_WIDTH + 60, Math.min(Math.max(420, maxWidth + 60), anchorLimit));

    return { maxWidth, maxHeight, anchorWidth };
}

function clampSendPopoverSize(shadow: ShadowRoot, width = appState.sendPopoverWidth, height = appState.sendPopoverHeight): {
    width: number;
    height: number;
    anchorWidth: number;
} {
    const constraints = getSendPopoverConstraints(shadow);
    const nextWidth = Math.max(MIN_SEND_POPOVER_WIDTH, Math.min(constraints.maxWidth, Math.round(width)));
    const nextHeight = Math.max(MIN_SEND_POPOVER_HEIGHT, Math.min(constraints.maxHeight, Math.round(height)));
    const anchorWidth = Math.max(nextWidth + 60, Math.min(constraints.anchorWidth, constraints.maxWidth + 60));
    return { width: nextWidth, height: nextHeight, anchorWidth };
}

function applySendPopoverSize(shadow: ShadowRoot, width = appState.sendPopoverWidth, height = appState.sendPopoverHeight): void {
    const next = clampSendPopoverSize(shadow, width, height);
    appState.sendPopoverWidth = next.width;
    appState.sendPopoverHeight = next.height;

    const popover = shadow.querySelector<HTMLElement>('.send-popover');
    if (popover) {
        popover.style.width = `${next.width}px`;
        popover.style.height = `${next.height}px`;
    }

    const anchor = shadow.querySelector<HTMLElement>('.popover-demo-anchor');
    if (anchor) {
        anchor.style.width = `${next.anchorWidth}px`;
        anchor.style.minHeight = `${Math.max(190, next.height + 110)}px`;
    }
}

function emitSponsorBurst(shadow: ShadowRoot, event: MouseEvent): void {
    const panel = shadow.querySelector<HTMLElement>('.sponsor-panel');
    const layer = shadow.querySelector<HTMLElement>('.sponsor-celebration');
    if (!panel || !layer) return;

    const rect = layer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const colors = [
        'var(--aimd-interactive-primary)',
        'var(--aimd-color-warning)',
        'color-mix(in srgb, var(--aimd-state-success-border) 72%, #10b981)',
        'color-mix(in srgb, var(--aimd-text-primary) 24%, white)',
    ];

    for (let index = 0; index < 18; index += 1) {
        const piece = document.createElement('span');
        piece.className = 'sponsor-burst-piece';
        const angle = (Math.PI * 2 * index) / 18;
        const distance = 44 + (index % 4) * 18;
        piece.style.left = `${x}px`;
        piece.style.top = `${y}px`;
        piece.style.setProperty('--piece-color', colors[index % colors.length]);
        piece.style.setProperty('--piece-x', `${Math.cos(angle) * distance}px`);
        piece.style.setProperty('--piece-y', `${Math.sin(angle) * distance}px`);
        piece.style.setProperty('--piece-rotate', `${index * 22}deg`);
        layer.appendChild(piece);
        window.setTimeout(() => piece.remove(), 920);
    }
}

function ensureShadowStylesheetLink(shadow: ShadowRoot, href: string, id: string): void {
    let link = shadow.querySelector<HTMLLinkElement>(`link[data-aimd-style-link="${id}"]`);
    if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.setAttribute('data-aimd-style-link', id);
        shadow.appendChild(link);
    }

    if (link.href !== href) {
        link.href = href;
    }
}

function createPanelStudio(root: HTMLElement): void {
    const host = document.createElement('div');
    host.className = 'aimd-panel-studio-host';
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    root.appendChild(host);
    let sendPopoverResizeState: {
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null = null;

    const render = () => {
        const preservedSettingsScrollTop = shadow.querySelector<HTMLElement>('.settings-panel')?.scrollTop ?? 0;
        ensureStyle(shadow, getTokenCss(appState.theme), { id: 'aimd-panel-studio-tokens' });
        ensureShadowStylesheetLink(shadow, katexCssUrl, 'aimd-panel-studio-katex');
        ensureStyle(shadow, overlayCssText, { id: 'aimd-panel-studio-tailwind', cache: 'shared' });
        ensureStyle(shadow, getStudioCss(), { id: 'aimd-panel-studio-base', cache: 'shared' });
        mount.innerHTML = getStudioHtml();
        shadow.querySelectorAll<HTMLInputElement>('input.tree-check[data-indeterminate="1"]').forEach((input) => {
            input.indeterminate = true;
        });
        if (appState.activePanel === 'sendPopover' && appState.sendPopoverOpen) {
            applySendPopoverSize(shadow);
        }
        const nextSettingsPanel = shadow.querySelector<HTMLElement>('.settings-panel');
        if (nextSettingsPanel && appState.bookmarksTab === 'settings') {
            nextSettingsPanel.scrollTop = preservedSettingsScrollTop;
        }
    };

    shadow.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (appState.bookmarksTab === 'sponsor' && target.closest('.sponsor-panel')) {
            emitSponsorBurst(shadow, event as MouseEvent);
        }

        const actionEl = target.closest('[data-action]') as HTMLElement | null;
        if (!actionEl) {
            let shouldRender = false;
            if (appState.platformMenuOpen && !target.closest('[data-platform-menu]')) {
                appState.platformMenuOpen = false;
                shouldRender = true;
            }
            if (appState.settingsMenuOpen && !target.closest('[data-settings-menu]')) {
                appState.settingsMenuOpen = null;
                shouldRender = true;
            }
            if (shouldRender) render();
            return;
        }

        const action = actionEl.dataset.action || '';

        if (appState.platformMenuOpen && action !== 'toggle-platform-menu' && action !== 'select-platform' && !target.closest('[data-platform-menu]')) {
            appState.platformMenuOpen = false;
        }
        if (appState.settingsMenuOpen && action !== 'toggle-settings-menu' && action !== 'select-settings-option' && !target.closest('[data-settings-menu]')) {
            appState.settingsMenuOpen = null;
        }

        if (action === 'set-theme') {
            appState.theme = (actionEl.dataset.theme as Theme) || 'light';
            render();
            return;
        }

        if (action === 'open-panel') {
            resetTransientUiState();
            appState.activePanel = (actionEl.dataset.panel as Exclude<PanelId, null>) || 'bookmarks';
            if (appState.activePanel === 'reader') appState.readerStatus = '';
            render();
            return;
        }

        if (action === 'close-panel') {
            resetTransientUiState();
            appState.activePanel = null;
            render();
            return;
        }

        if (action === 'set-bookmarks-tab') {
            appState.bookmarksTab = (actionEl.dataset.tab as BookmarksTabId) || 'bookmarks';
            appState.platformMenuOpen = false;
            render();
            return;
        }

        if (action === 'toggle-platform-menu') {
            appState.platformMenuOpen = !appState.platformMenuOpen;
            render();
            return;
        }

        if (action === 'select-platform') {
            appState.platform = actionEl.dataset.value || 'All';
            appState.platformMenuOpen = false;
            render();
            return;
        }

        if (action === 'toggle-settings-menu') {
            const menu = (actionEl.dataset.menu as Exclude<SettingsMenuId, null>) || null;
            appState.settingsMenuOpen = appState.settingsMenuOpen === menu ? null : menu;
            render();
            return;
        }

        if (action === 'select-settings-option') {
            const menu = (actionEl.dataset.menu as Exclude<SettingsMenuId, null>) || null;
            const value = actionEl.dataset.value || '';
            if (menu === 'folding-mode') {
                appState.settings.chatgpt.foldingMode = value as SettingsState['chatgpt']['foldingMode'];
            }
            if (menu === 'language') {
                appState.settings.language = value as SettingsState['language'];
            }
            appState.settingsMenuOpen = null;
            render();
            return;
        }

        if (action === 'settings-step-count') {
            const direction = actionEl.dataset.direction === 'down' ? -1 : 1;
            appState.settings.chatgpt.defaultExpandedCount = Math.max(0, appState.settings.chatgpt.defaultExpandedCount + direction);
            render();
            return;
        }

        if (action === 'toggle-sort-time') {
            appState.sortMode = appState.sortMode === 'time-desc' ? 'time-asc' : 'time-desc';
            render();
            return;
        }

        if (action === 'toggle-sort-alpha') {
            appState.sortMode = appState.sortMode === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc';
            render();
            return;
        }

        if (action === 'toggle-folder-expand') {
            const path = actionEl.dataset.path || '';
            if (appState.expandedPaths.has(path)) appState.expandedPaths.delete(path);
            else appState.expandedPaths.add(path);
            render();
            return;
        }

        if (action === 'toggle-folder-selection') {
            const path = actionEl.dataset.path || '';
            toggleFolderSelection(path);
            render();
            return;
        }

        if (action === 'toggle-bookmark-selection') {
            const id = actionEl.dataset.id || '';
            if (appState.selectedBookmarkIds.has(id)) appState.selectedBookmarkIds.delete(id);
            else appState.selectedBookmarkIds.add(id);
            render();
            return;
        }

        if (action === 'open-reader-bookmark') {
            openReaderForBookmark(actionEl.dataset.id || '');
            render();
            return;
        }

        if (action === 'bookmark-row-action') {
            const op = actionEl.dataset.op || '';
            const id = actionEl.dataset.id || '';
            const bookmark = findBookmarkById(id);
            if (!bookmark) return;
            if (op === 'open') {
                openReaderForBookmark(id);
                setStatus('bookmarkStatus', `Would navigate to ${bookmark.platform} message position ${bookmark.position}.`);
            } else if (op === 'copy') {
                setStatus('bookmarkStatus', `Copied markdown from "${bookmark.title}".`);
            } else if (op === 'delete') {
                openModal({
                    action: 'bookmarks:delete-bookmark',
                    kind: 'warning',
                    title: 'Delete bookmark',
                    message: `Delete "${bookmark.title}"? This mirrors the confirmation in the real panel.`,
                    mode: 'confirm',
                    value: '',
                    payload: id,
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    danger: true,
                });
            }
            render();
            return;
        }

        if (action === 'bookmarks-top-action') {
            const op = actionEl.dataset.op || '';
            if (op === 'create-folder') {
                openModal({
                    action: 'bookmarks:create-folder',
                    kind: 'info',
                    title: 'Create folder',
                    message: 'Enter a folder path such as `Archive` or `Archive/May`.',
                    mode: 'prompt',
                    value: '',
                    confirmText: 'Save',
                    cancelText: 'Cancel',
                });
            } else if (op === 'import') {
                setStatus('bookmarkStatus', 'Import flow placeholder: the real panel opens a file picker and then asks whether to save context only.');
            } else if (op === 'export-all') {
                setStatus('bookmarkStatus', 'Exported all bookmarks as JSON.');
            } else if (op === 'export-selected') {
                setStatus('bookmarkStatus', `Exported ${appState.selectedBookmarkIds.size} selected bookmark(s).`);
            }
            render();
            return;
        }

        if (action === 'bookmarks-folder-action') {
            const op = actionEl.dataset.op || '';
            const path = actionEl.dataset.path || '';
            if (op === 'create-subfolder') {
                openModal({
                    action: 'bookmarks:create-subfolder',
                    kind: 'info',
                    title: 'New subfolder',
                    message: `Create a subfolder inside "${path}".`,
                    mode: 'prompt',
                    value: '',
                    payload: path,
                    confirmText: 'Save',
                    cancelText: 'Cancel',
                });
            } else if (op === 'rename-folder') {
                openModal({
                    action: 'bookmarks:rename-folder',
                    kind: 'info',
                    title: 'Rename folder',
                    message: `Rename "${path}".`,
                    mode: 'prompt',
                    value: splitPath(path).at(-1) || '',
                    payload: path,
                    confirmText: 'Save',
                    cancelText: 'Cancel',
                });
            } else if (op === 'move-folder') {
                openModal({
                    action: 'bookmarks:move-folder',
                    kind: 'info',
                    title: 'Move folder',
                    message: 'Enter the target parent folder path, or leave empty to move to root.',
                    mode: 'prompt',
                    value: '',
                    payload: path,
                    confirmText: 'Move',
                    cancelText: 'Cancel',
                });
            } else if (op === 'delete-folder') {
                openModal({
                    action: 'bookmarks:delete-folder',
                    kind: 'warning',
                    title: 'Delete folder',
                    message: `Delete "${path}" and everything under it?`,
                    mode: 'confirm',
                    value: '',
                    payload: path,
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    danger: true,
                });
            }
            render();
            return;
        }

        if (action === 'batch-clear') {
            appState.selectedBookmarkIds.clear();
            setStatus('bookmarkStatus', 'Cleared bookmark selection.');
            render();
            return;
        }

        if (action === 'batch-move') {
            openModal({
                action: 'bookmarks:move-selection',
                kind: 'info',
                title: 'Move selected bookmarks',
                message: 'Enter an existing destination folder path.',
                mode: 'prompt',
                value: appState.selectedFolderPath || 'Product/UX',
                confirmText: 'Move',
                cancelText: 'Cancel',
            });
            render();
            return;
        }

        if (action === 'batch-delete') {
            const ids = Array.from(appState.selectedBookmarkIds);
            ids.forEach((id) => void deleteBookmark(id));
            appState.selectedBookmarkIds.clear();
            setStatus('bookmarkStatus', `Deleted ${ids.length} selected bookmark(s).`);
            render();
            return;
        }

        if (action === 'batch-export') {
            setStatus('bookmarkStatus', `Exported ${appState.selectedBookmarkIds.size} selected bookmark(s).`);
            render();
            return;
        }

        if (action === 'settings-export-backup') {
            setStatus('bookmarkStatus', 'Exported full bookmark backup.');
            appState.bookmarksTab = 'settings';
            render();
            return;
        }

        if (action === 'sponsor-github') {
            setStatus('bookmarkStatus', 'Would open the GitHub repository in a new tab.');
            appState.bookmarksTab = 'sponsor';
            render();
            return;
        }

        if (action === 'reader-prev') {
            appState.readerIndex = Math.max(0, appState.readerIndex - 1);
            appState.readerStatus = '';
            render();
            return;
        }

        if (action === 'reader-next') {
            const max = Math.max(0, getVisibleBookmarksForReader().length - 1);
            appState.readerIndex = Math.min(max, appState.readerIndex + 1);
            appState.readerStatus = '';
            render();
            return;
        }

        if (action === 'reader-jump') {
            appState.readerIndex = Number(actionEl.dataset.index || 0);
            appState.readerStatus = '';
            render();
            return;
        }

        if (action === 'reader-copy') {
            const bookmark = currentReaderBookmark();
            setStatus('readerStatus', bookmark ? `Copied markdown from "${bookmark.title}".` : '');
            render();
            return;
        }

        if (action === 'reader-source') {
            const bookmark = currentReaderBookmark();
            appState.sourceTitle = bookmark ? truncate(bookmark.userPrompt, 40) : 'Raw source';
            appState.sourceStatus = 'Copied status messages appear here in the real panel.';
            appState.activePanel = 'source';
            render();
            return;
        }

        if (action === 'reader-fullscreen') {
            appState.readerFullscreen = !appState.readerFullscreen;
            render();
            return;
        }

        if (action === 'reader-open-conversation') {
            const bookmark = currentReaderBookmark();
            setStatus('readerStatus', bookmark ? `Would reopen the original ${bookmark.platform} conversation and jump to position ${bookmark.position}.` : '');
            render();
            return;
        }

        if (action === 'reader-toggle-bookmark') {
            const bookmark = currentReaderBookmark();
            if (bookmark) {
                if (appState.selectedBookmarkIds.has(bookmark.id)) appState.selectedBookmarkIds.delete(bookmark.id);
                else appState.selectedBookmarkIds.add(bookmark.id);
                setStatus('readerStatus', `"${bookmark.title}" is now ${appState.selectedBookmarkIds.has(bookmark.id) ? 'selected' : 'unselected'} in the bookmarks panel.`);
            }
            render();
            return;
        }

        if (action === 'reader-send-toggle') {
            appState.readerSendPopoverOpen = !appState.readerSendPopoverOpen;
            render();
            return;
        }

        if (action === 'reader-locate') {
            const bookmark = currentReaderBookmark();
            setStatus('readerStatus', bookmark ? `Would scroll to message position ${bookmark.position} in the live thread.` : '');
            render();
            return;
        }

        if (action === 'source-copy') {
            setStatus('sourceStatus', 'Copied raw source.');
            render();
            return;
        }

        if (action === 'toggle-turn') {
            const index = Number(actionEl.dataset.index || 0);
            if (appState.selectedTurns.has(index)) appState.selectedTurns.delete(index);
            else appState.selectedTurns.add(index);
            render();
            return;
        }

        if (action === 'set-format') {
            appState.saveFormat = (actionEl.dataset.format as SaveFormat) || 'markdown';
            render();
            return;
        }

        if (action === 'select-all-turns') {
            appState.selectedTurns = new Set(conversationTurns.map((_, index) => index));
            render();
            return;
        }

        if (action === 'deselect-all-turns') {
            appState.selectedTurns.clear();
            render();
            return;
        }

        if (action === 'save-turns') {
            setStatus('saveMessagesStatus', `Saved ${appState.selectedTurns.size} turn(s) as ${appState.saveFormat}.`);
            render();
            return;
        }

        if (action === 'bookmark-save-toggle-folder') {
            const path = actionEl.dataset.path || '';
            if (appState.bookmarkSaveExpandedPaths.has(path)) appState.bookmarkSaveExpandedPaths.delete(path);
            else appState.bookmarkSaveExpandedPaths.add(path);
            render();
            return;
        }

        if (action === 'bookmark-save-select-folder') {
            appState.bookmarkSaveSelectedFolderPath = actionEl.dataset.path || null;
            setStatus('bookmarkSaveStatus', `Selected folder "${appState.bookmarkSaveSelectedFolderPath}".`);
            render();
            return;
        }

        if (action === 'bookmark-save-inline-folder') {
            appState.bookmarkSaveInlineParentPath = actionEl.dataset.path || null;
            appState.bookmarkSaveInlineDraft = '';
            render();
            return;
        }

        if (action === 'bookmark-save-inline-confirm') {
            handleInlineBookmarkSaveFolder();
            render();
            return;
        }

        if (action === 'bookmark-save-inline-cancel') {
            appState.bookmarkSaveInlineParentPath = null;
            appState.bookmarkSaveInlineDraft = '';
            render();
            return;
        }

        if (action === 'bookmark-save-new-root-folder') {
            openModal({
                action: 'bookmarkSave:create-root-folder',
                kind: 'info',
                title: 'New folder',
                message: 'Create a root-level folder for bookmark saves.',
                mode: 'prompt',
                value: '',
                confirmText: 'Save',
                cancelText: 'Cancel',
            });
            render();
            return;
        }

        if (action === 'open-dialog-preview') {
            openDialogPreview((actionEl.dataset.dialog as DialogPreviewId) || 'info');
            render();
            return;
        }

        if (action === 'bookmark-save-submit') {
            if (!appState.bookmarkSaveTitle.trim() || !appState.bookmarkSaveSelectedFolderPath) return;
            setStatus('bookmarkSaveStatus', `Saved "${appState.bookmarkSaveTitle}" into "${appState.bookmarkSaveSelectedFolderPath}".`);
            render();
            return;
        }

        if (action === 'send-submit') {
            if (!appState.sendDraft.trim()) {
                setStatus('sendStatus', 'Message cannot be empty.');
            } else {
                setStatus('sendStatus', 'Sent through the current site composer.');
            }
            render();
            return;
        }

        if (action === 'toggle-send-popover') {
            appState.sendPopoverOpen = !appState.sendPopoverOpen;
            render();
            return;
        }

        if (action === 'send-popover-resize') {
            return;
        }

        if (action === 'modal-cancel') {
            closeModal();
            render();
            return;
        }

        if (action === 'modal-confirm') {
            confirmModal();
            render();
        }
    });

    shadow.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target) return;
        const role = target.dataset.role || '';

        if (role === 'settings-platform-chatgpt') appState.settings.platforms.chatgpt = target.checked;
        if (role === 'settings-platform-gemini') appState.settings.platforms.gemini = target.checked;
        if (role === 'settings-platform-claude') appState.settings.platforms.claude = target.checked;
        if (role === 'settings-platform-deepseek') appState.settings.platforms.deepseek = target.checked;
        if (role === 'settings-fold-dock') appState.settings.chatgpt.showFoldDock = target.checked;
        if (role === 'settings-show-view-source') appState.settings.behavior.showViewSource = target.checked;
        if (role === 'settings-show-save-messages') appState.settings.behavior.showSaveMessages = target.checked;
        if (role === 'settings-show-word-count') appState.settings.behavior.showWordCount = target.checked;
        if (role === 'settings-click-to-copy') appState.settings.behavior.enableClickToCopy = target.checked;
        if (role === 'settings-save-context-only') appState.settings.behavior.saveContextOnly = target.checked;
        if (role === 'settings-render-code-reader') appState.settings.reader.renderCodeInReader = target.checked;

        render();
    });

    shadow.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (!target) return;
        const role = target.dataset.role || '';

        if (role === 'bookmark-query') appState.query = target.value;
        if (role === 'bookmark-save-title') appState.bookmarkSaveTitle = target.value;
        if (role === 'bookmark-save-inline-draft') appState.bookmarkSaveInlineDraft = target.value;
        if (role === 'modal-input' && appState.modal) appState.modal.value = target.value;
        if (role === 'send-draft') appState.sendDraft = target.value;
        if (role === 'settings-folding-count') {
            const value = Number(target.value);
            appState.settings.chatgpt.defaultExpandedCount = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
        }
    });

    shadow.addEventListener('mousedown', (event) => {
        const target = event.target as HTMLElement | null;
        const handle = target?.closest('[data-action="send-popover-resize"]') as HTMLElement | null;
        if (!handle) return;

        const popover = handle.closest('.send-popover') as HTMLElement | null;
        if (!popover) return;

        event.preventDefault();
        const rect = popover.getBoundingClientRect();
        sendPopoverResizeState = {
            startX: event.clientX,
            startY: event.clientY,
            startWidth: rect.width || appState.sendPopoverWidth,
            startHeight: rect.height || appState.sendPopoverHeight,
        };
    });

    window.addEventListener('mousemove', (event) => {
        if (!sendPopoverResizeState) return;
        const widthDelta = event.clientX - sendPopoverResizeState.startX;
        const heightDelta = sendPopoverResizeState.startY - event.clientY;
        applySendPopoverSize(shadow, sendPopoverResizeState.startWidth + widthDelta, sendPopoverResizeState.startHeight + heightDelta);
    });

    window.addEventListener('mouseup', () => {
        sendPopoverResizeState = null;
    });

    window.addEventListener('resize', () => {
        if (appState.activePanel !== 'sendPopover' || !appState.sendPopoverOpen) return;
        applySendPopoverSize(shadow);
    });

    render();
}

const root = document.getElementById('app');
if (root) createPanelStudio(root);
