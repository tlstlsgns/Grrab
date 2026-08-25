/**
 * Full-screen in-page erase overlay: select one rect, Remove, repeat, Clip.
 * Returns the finished image blob (or the original on cancel).
 */

const KC_ERASE_Z = 2147483646;
const KC_ERASE_DEFAULT_STATUS = 'Preparing image…';
const KC_BRUSH_MIN = 10;
const KC_BRUSH_MAX = 120;
const KC_REMOVE_LABEL = 'Remove';
const KC_CLIP_LABEL = 'Clip';
const KC_BACK_LABEL = 'Back';
const KC_REMOVING_LABEL = 'Removing…';
const KC_REMOVING_BG_LABEL = 'Removing BG…';
// PHASE_BUSY_OVERLAY: captions for the in-stage progress cluster. Remove and Remove BG
// share one: both take something away, and two near-identical words would read as a
// distinction that is not there.
const KC_BUSY_UPSCALING = 'Upscaling…';
// PHASE_SR_LIMIT: shown on hover when the button is disabled for size. A pass shrinks an
// oversized source to the provider's ceiling first, so past ceiling x 16 the result comes
// back smaller than what went in.
const KC_UPSCALE_LIMIT_HINT = 'Too large to upscale';
const KC_BUSY_REMOVING = 'Removing…';
const KC_ICON_BOX = '<svg style="display:block" width="16" height="16" viewBox="0 0 122 123" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip_kc_icon_box)"> <mask id="mask_kc_icon_box" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="122" height="123"> <path d="M121.65 0H0V122.88H121.65V0Z" fill="white"/> </mask> <g mask="url(#mask_kc_icon_box)"><path d="M1.95953 0.278813L1.90953 0.298813L1.87953 0.318813C1.80953 0.348813 1.74953 0.378813 1.68953 0.418813L1.66953 0.428813L1.60953 0.458813L1.57953 0.478813C1.54953 0.498813 1.51953 0.518813 1.48953 0.538813L1.44953 0.568813H1.43953L1.40953 0.588813L1.37953 0.608813L1.33953 0.638813L1.28953 0.678813H1.27953C0.729527 1.10881 0.329527 1.68881 0.139527 2.35881C0.0295275 2.69881 -0.0104725 3.06881 -0.00047256 3.42881V5.47881C0.0195275 8.02881 2.77953 9.59881 4.97953 8.27881C5.64953 7.86881 6.12953 7.25881 6.37953 6.54881H9.83953C12.3895 6.52881 13.9595 3.76881 12.6395 1.56881C12.0295 0.588813 10.9995 0.00881356 9.83953 -0.00118644H3.41953C2.93953 -0.0211865 2.43953 0.0688135 1.95953 0.278813ZM101.11 122.859C101.2 122.879 101.3 122.879 101.4 122.859C101.43 122.839 101.47 122.819 101.5 122.809L111.26 117.179C111.35 117.119 111.41 117.019 111.44 116.919C111.46 116.839 111.46 116.759 111.43 116.709L100.73 98.0588C100.64 97.8988 100.58 97.7288 100.54 97.5488C100.35 96.6088 100.95 95.6988 101.89 95.5088L117.59 92.2588C117.61 92.2488 117.63 92.2488 117.65 92.2488C119 91.9688 120.15 91.4888 120.91 90.8888C121.28 90.5988 121.53 90.2988 121.63 90.0188C121.69 89.8388 121.66 89.6288 121.54 89.3888C121.32 88.9788 120.88 88.5188 120.15 88.0288L66.7895 51.4888L71.7395 115.949C71.8095 116.829 71.9795 117.439 72.2195 117.829C72.3595 118.059 72.5295 118.179 72.7195 118.219C73.0095 118.279 73.3895 118.209 73.8295 118.039C74.7295 117.679 75.7095 116.919 76.6395 115.889L87.3495 103.869C87.4695 103.739 87.6095 103.619 87.7795 103.519C88.6095 103.039 89.6695 103.319 90.1495 104.149L100.95 122.739C100.97 122.799 101.03 122.839 101.11 122.859ZM1.60953 0.458813C1.56953 0.488813 1.52953 0.508813 1.48953 0.538813L1.60953 0.458813ZM6.55953 18.5888C6.53953 16.0388 3.77953 14.4688 1.57953 15.7888C0.589527 16.3988 0.00952744 17.4288 -0.00047256 18.5888V25.1388C0.0195275 27.6888 2.77953 29.2588 4.97953 27.9388C5.96953 27.3288 6.54953 26.2988 6.55953 25.1388V18.5888ZM6.55953 38.2588C6.53953 35.7088 3.77953 34.1388 1.57953 35.4588C0.589527 36.0588 0.00952744 37.0988 -0.00047256 38.2588V44.8088C0.0195275 47.3588 2.77953 48.9288 4.97953 47.6088C5.96953 46.9988 6.54953 45.9688 6.55953 44.8088V38.2588ZM6.55953 57.9188C6.53953 55.3688 3.77953 53.7988 1.57953 55.1188C0.589527 55.7288 0.00952744 56.7588 -0.00047256 57.9188V64.4788C0.0195275 67.0288 2.77953 68.5988 4.97953 67.2788C5.96953 66.6688 6.54953 65.6388 6.55953 64.4788V57.9188ZM6.55953 77.5888C6.53953 75.0388 3.77953 73.4688 1.57953 74.7888C0.589527 75.3988 0.00952744 76.4288 -0.00047256 77.5888V84.1388C0.0195275 86.6888 2.77953 88.2588 4.97953 86.9388C5.96953 86.3288 6.54953 85.2988 6.55953 84.1388V77.5888ZM6.55953 97.2488C6.53953 94.6988 3.77953 93.1288 1.57953 94.4488C0.589527 95.0588 0.00952744 96.0888 -0.00047256 97.2488V103.809C0.0195275 106.359 2.77953 107.929 4.97953 106.609C5.96953 105.999 6.54953 104.969 6.55953 103.809V97.2488ZM13.1295 103.789C10.5795 103.809 9.00953 106.569 10.3295 108.769C10.9395 109.759 11.9695 110.339 13.1295 110.349H19.6795C22.2295 110.329 23.7995 107.569 22.4795 105.369C21.8695 104.379 20.8395 103.799 19.6795 103.789H13.1295ZM32.7895 103.789C30.2395 103.809 28.6695 106.569 29.9895 108.769C30.5995 109.759 31.6295 110.339 32.7895 110.349H39.3495C41.8995 110.329 43.4695 107.569 42.1495 105.369C41.5395 104.379 40.5095 103.799 39.3495 103.789H32.7895ZM52.4595 103.789C49.9095 103.809 48.3395 106.569 49.6595 108.769C50.2695 109.759 51.2995 110.339 52.4595 110.349H59.0195C61.5695 110.329 63.1395 107.569 61.8195 105.369C61.2095 104.379 60.1795 103.799 59.0195 103.789H52.4595ZM103.79 63.3588C103.81 65.9088 106.57 67.4788 108.77 66.1588C109.76 65.5488 110.34 64.5188 110.35 63.3588V56.7988C110.33 54.2488 107.57 52.6788 105.37 53.9988C104.38 54.6088 103.8 55.6388 103.79 56.7988V63.3588ZM103.79 43.6988C103.81 46.2488 106.57 47.8188 108.77 46.4988C109.76 45.8888 110.34 44.8588 110.35 43.6988V37.1388C110.33 34.5888 107.57 33.0188 105.37 34.3388C104.38 34.9488 103.8 35.9788 103.79 37.1388V43.6988ZM103.79 24.0288C103.81 26.5788 106.57 28.1488 108.77 26.8288C109.76 26.2188 110.34 25.1888 110.35 24.0288V17.4788C110.33 14.9288 107.57 13.3588 105.37 14.6788C104.38 15.2888 103.8 16.3188 103.79 17.4788V24.0288ZM104.63 6.55881C105.62 7.65881 107.32 8.04881 108.77 7.16881C109.76 6.55881 110.34 5.52881 110.35 4.36881V3.41881C110.38 2.80881 110.23 2.16881 109.88 1.57881C109.27 0.588813 108.24 0.00881356 107.08 -0.00118644H101.61C99.0595 0.0188135 97.4895 2.77881 98.8095 4.97881C99.4195 5.96881 100.45 6.54881 101.61 6.55881H104.63ZM88.4995 6.55881C91.0495 6.53881 92.6195 3.77881 91.2995 1.57881C90.6895 0.588813 89.6595 0.00881356 88.4995 -0.00118644H81.9495C79.3995 0.0188135 77.8295 2.77881 79.1495 4.97881C79.7595 5.96881 80.7895 6.54881 81.9495 6.55881H88.4995ZM68.8295 6.55881C71.3795 6.53881 72.9495 3.77881 71.6295 1.57881C71.0195 0.588813 69.9895 0.00881356 68.8295 -0.00118644H62.2695C59.7195 0.0188135 58.1495 2.77881 59.4695 4.97881C60.0795 5.96881 61.1095 6.54881 62.2695 6.55881H68.8295ZM49.1695 6.55881C51.7195 6.53881 53.2895 3.77881 51.9695 1.57881C51.3595 0.588813 50.3295 0.00881356 49.1695 -0.00118644H42.6095C40.0595 0.0188135 38.4895 2.77881 39.8095 4.97881C40.4195 5.96881 41.4495 6.54881 42.6095 6.55881H49.1695ZM29.4995 6.55881C32.0495 6.53881 33.6195 3.77881 32.2995 1.57881C31.6995 0.588813 30.6595 0.00881356 29.4995 -0.00118644H22.9495C20.3995 0.0188135 18.8295 2.77881 20.1495 4.97881C20.7595 5.96881 21.7895 6.54881 22.9495 6.55881H29.4995Z" fill="currentColor"/> </g> </g> <defs> <clipPath id="clip_kc_icon_box"> <rect width="122" height="123" fill="white"/> </clipPath> </defs> </svg>';
const KC_ICON_BRUSH = '<svg style="display:block" width="16" height="16" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip_kc_icon_brush)"> <path d="M260.969 483.344C198.281 487.375 141.391 511.25 109.109 596.313C105.438 606.016 96.6094 611.906 86.3125 611.906C68.9531 611.906 15.2812 568.672 -0.015625 558.234C-3.49246e-10 686.906 59.2656 800 200 800C318.531 800 400 731.609 400 612.203C400 607.344 398.984 602.703 398.484 597.937L260.969 483.344ZM715.453 0C691.766 0 669.563 10.4844 652.625 25.7031C333.234 311.016 300 317.719 300 401.703C300 423.109 305.078 443.516 313.641 462.172L413.359 545.266C424.625 548.078 436.234 550 448.344 550C545.391 550 601.641 478.953 778.281 149.281C789.813 126.859 800 102.641 800 77.4219C800 32.25 759.375 0 715.453 0Z" fill="currentColor"/> <path d="M779.18 711.214H572.594C572.239 710.469 572 709.647 572 708.761C572 707.335 572.581 706.058 573.453 705.046H700.845C709.983 705.046 717.373 697.666 717.373 688.517C717.373 679.392 709.983 672 700.845 672L421.917 672C422.398 696.061 415.486 720.109 401.181 740.416C383.653 765.298 358.659 785.592 329 799.847L732.83 799.847C743.066 799.847 751.367 791.544 751.367 781.297C751.367 771.049 743.064 762.746 732.83 762.746H646.28C641.125 762.746 636.941 758.577 636.941 753.421C636.941 751.474 637.675 749.807 638.659 748.316H779.181C789.43 748.316 797.745 740.027 797.745 729.764C797.744 719.518 789.428 711.214 779.18 711.214Z" fill="currentColor"/> </g> <defs> <clipPath id="clip_kc_icon_brush"> <rect width="800" height="800" fill="white"/> </clipPath> </defs> </svg>';
const KC_ICON_BACK = '<svg style="display:block;flex:0 0 auto" width="14" height="14" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M775.227 536.663C721.167 354.214 556.817 226.628 366.637 217.696V84.0424C366.637 70.5766 358.537 58.4123 346.072 53.2456C333.606 48.0462 319.274 50.9459 309.743 60.4777L9.7736 360.447C-3.25787 373.478 -3.25787 394.543 9.7736 407.575L309.743 707.543C319.274 717.075 333.607 719.975 346.072 714.776C358.537 709.643 366.637 697.445 366.637 683.979V512.465C431.363 505.899 605.979 512.532 737.965 734.375C743.832 744.274 754.297 749.306 765.363 749.306C768.729 749.306 772.095 748.839 775.461 747.939C789.893 743.973 799.959 729.274 799.959 714.276C800.659 654.051 792.325 594.29 775.227 536.663Z" fill="currentColor"/> </svg>';
const KC_ICON_REFRESH = '<svg style="display:block;flex:0 0 auto" width="14" height="14" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip_kc_icon_refresh)"> <path fill-rule="evenodd" clip-rule="evenodd" d="M771.45 64.0015C784.925 50.5015 800.225 38.75 800.225 25C800.225 11.25 789.05 0 775.225 0H525.225C522.2 0 500.225 0 500.225 25V275C500.225 288.75 511.425 300 525.225 300C539.05 300 548.675 286.751 559.325 276.251L628.8 206.75C673.05 259 700 326.25 700 400C700 565.75 565.675 700 400 700C234.325 700 100 565.75 100 400C100 251.5 208.175 128.251 350 104.501V3.50037C152.725 28.0004 0 196 0 400C0 621 179.1 800 400 800C620.9 800 800 621 800 400C800 298.5 762.1 206.251 699.825 135.751L771.45 64.0015Z" fill="currentColor"/> </g> <defs> <clipPath id="clip_kc_icon_refresh"> <rect width="800" height="800" fill="white"/> </clipPath> </defs> </svg>';
const KC_ICON_CLIP = '<svg style="display:block;flex:0 0 auto" width="14" height="14" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M508 66.666H378.193C319.386 66.6657 272.806 66.665 236.351 71.586C198.834 76.6504 168.467 87.3207 144.52 111.365C120.572 135.408 109.944 165.897 104.9 203.565C99.999 240.166 99.9997 286.933 100 345.976V540.563C100 590.833 130.665 633.913 174.239 651.973C171.996 621.659 171.998 579.123 172 543.733V379.919V376.746C171.998 334.023 171.995 297.214 175.943 267.736C180.173 236.145 189.713 205.863 214.177 181.301C238.64 156.739 268.801 147.161 300.266 142.914C329.626 138.951 366.29 138.953 408.84 138.955L412 138.955H508L511.16 138.955C553.71 138.953 590.293 138.951 619.653 142.914C602.09 98.259 558.72 66.666 508 66.666Z" fill="currentColor"/> <path d="M220.004 379.914C220.004 289.04 220.004 243.604 248.122 215.373C276.239 187.143 321.494 187.143 412.004 187.143H508.004C598.514 187.143 643.767 187.143 671.887 215.373C700.004 243.604 700.004 289.041 700.004 379.914V540.557C700.004 631.431 700.004 676.867 671.887 705.097C643.767 733.327 598.514 733.327 508.004 733.327H412.004C321.494 733.327 276.239 733.327 248.122 705.097C220.004 676.867 220.004 631.431 220.004 540.557V379.914Z" fill="currentColor"/> </svg>';
const KC_ICON_ERASE = '<svg style="display:block;flex:0 0 auto" width="14" height="14" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg"> <g clip-path="url(#clip_kc_icon_erase)"> <path fill-rule="evenodd" clip-rule="evenodd" d="M467.389 635.953L186.26 354.777L510.119 30.9649C525.272 15.6708 550.401 16.1884 566.166 32.0002L790.26 255.953C805.977 271.765 806.495 296.847 791.248 312L467.389 635.953Z" fill="currentColor"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M421.789 687.53C347.342 762.024 166.071 701.647 87.5769 623.153C9.17694 544.706 63.1064 477.883 137.6 403.389L421.789 687.53Z" fill="currentColor"/> </g> <defs> <clipPath id="clip_kc_icon_erase"> <rect width="800" height="800" fill="white"/> </clipPath> </defs> </svg>';
const KC_ICON_REMOVEBG = '<svg style="display:block;flex:0 0 auto" width="14" height="14" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M700 0C755.225 0 800 44.775 800 100V700C800 755.225 755.225 800 700 800H100C44.775 800 0 755.225 0 700V100C0 44.775 44.775 0 100 0H700ZM50 676.525V700C50 727.6 72.4 750 100 750H500.025L248.625 498.625L50 676.525ZM386.6 563.375L570.8 750H700C727.6 750 750 727.6 750 700V499.975L600 349.975L386.6 563.375ZM50 421V538H167V421H50ZM400 71V188H284V304H167V188H50V305H167V421H284V305H400V421H517V305H634V188H517V304H401V188H517V71H400ZM167 71V188H284V71H167ZM634 71V188H751V71H634Z" fill="currentColor"/> </svg>';
const KC_ICON_UPSCALE = '<svg style="display:block;flex:0 0 auto" width="14" height="14" viewBox="0 0 843 836" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M639.332 145.556C653.385 144.634 665.524 155.28 666.445 169.333L681.459 398.341C682.38 412.394 671.735 424.534 657.682 425.455C643.629 426.376 631.49 415.73 630.568 401.678L619.581 234.099L378.672 508.814C369.386 519.402 353.275 520.458 342.687 511.173C332.098 501.887 331.043 485.777 340.328 475.188L581.237 200.473L413.66 211.46C399.607 212.381 387.467 201.736 386.546 187.682C385.625 173.63 396.27 161.491 410.323 160.569L639.332 145.556Z" fill="currentColor"/> <path d="M257.51 555.774C257.914 571.728 270.772 584.586 286.726 584.99L287.5 585H761.5L762.274 584.99C778.485 584.579 791.5 571.31 791.5 555V81C791.5 64.4315 778.069 51 761.5 51V0C806.235 0 842.5 36.265 842.5 81V555C842.5 599.735 806.235 636 761.5 636H287.5C242.765 636 206.5 599.735 206.5 555V81C206.5 36.2649 242.765 0 287.5 0V51C270.931 51 257.5 64.4315 257.5 81V555L257.51 555.774ZM761.5 0V51H287.5V0H761.5Z" fill="currentColor"/> <path d="M0 755V280C0 235.541 36.0411 199.5 80.5 199.5H206.5V250.5H80.5C64.2076 250.5 51 263.708 51 280V755C51 771.292 64.2076 784.5 80.5 784.5H555.5C571.792 784.5 585 771.292 585 755V636H636V755C636 799.459 599.959 835.5 555.5 835.5H80.5C36.0411 835.5 0 799.459 0 755Z" fill="currentColor"/> </svg>';
let statusText = KC_ERASE_DEFAULT_STATUS;
let statusOverride = '';
let pointerInside = false;

/**
 * @param {Blob|Promise<Blob|null>} blob - source image, or a promise of one
 * @param {(blob: Blob, maskDataUrl: string) => Promise<Blob|null>} inpaintFn
 * @param {(blob: Blob) => void} [commitFn]
 * @param {(setter: (text: string) => void) => void} [bindStatus]
 * @param {(blob: Blob) => Promise<Blob|{error: string}|null>} [bgFn]
 * @param {(blob: Blob) => Promise<Blob|null>} [upscaleFn]
 * @param {() => Promise<number>} [srMaxPixelsFn]
 * @returns {Promise<{ action: 'done'|'cancel', blob: Blob|null, modified?: boolean, bgRemoved?: boolean, erased?: boolean, upscaled?: boolean }>}
 */
export function showEraseOverlay(blob, inpaintFn, commitFn, bindStatus, bgFn, upscaleFn, srMaxPixelsFn) {
  let finishRef = null;
  const p = new Promise((resolve) => {
    statusText = KC_ERASE_DEFAULT_STATUS;
    statusOverride = '';
    pointerInside = false;
    let settled = false;
    let loading = true;
    let originalBlob = null;
    let current = null;
    let draft = null;
    // Every previous image, so Undo always reaches the original. Entries are
    // PNG-compressed Blobs, a few MB each, and the whole overlay including this array is
    // released when the clip ends — so the ceiling is one editing session, not the
    // browser's lifetime.
    const history = [];
    let bgApplied = false;
    const bgHistory = [];
    let eraseApplied = false;
    const eraseHistory = [];
    // PHASE_SR_BUTTON: kept in step with history — every history.push pushes here too,
    // and undoLast pops all of them together, so Undo restores the flag that went with
    // the image being restored.
    // PHASE_SR_LIMIT: the largest output a pass can produce, in pixels — the provider's
    // input ceiling times sixteen. 0 means not yet known, and while it is 0 the button
    // stays enabled: settling a moment late is better than flickering on every open.
    let srMaxOutPx = 0;
    let srApplied = false;
    const srHistory = [];
    let busy = false;
    let scale = 1;
    // PHASE_FIXED_STAGE: the stage is a fixed box and the image is letterboxed inside
    // it, so a stage coordinate is no longer an image coordinate. offX/offY are the
    // image's top-left corner within the stage, in stage pixels.
    let offX = 0;
    let offY = 0;
    let srcW = 0;
    let srcH = 0;
    let blobUrl = null;
    // PHASE_REVEAL: a copy of the outgoing image, layered over the new one and clipped
    // away from the right. It holds the previous object URL, so that URL outlives the
    // swap and is revoked when the copy is torn down rather than in loadBlobIntoImage.
    let revealEl = null;
    let revealUrl = null;
    let revealAnim = null;
    // PHASE_REVEAL: the edge marker. It cannot be a border on revealEl, because
    // clip-path would clip it away along with the rest of that element.
    let revealBar = null;
    let revealBarAnim = null;
    let mode = 'brush';
    let brushSize = 40;
    let selections = [];
    let activeStroke = null;
    let brushCursorPt = null;

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const root = document.createElement('div');
    root.className = 'kc-erase-root';
    root.setAttribute('data-kc-ui', 'erase-overlay');
    root.setAttribute('tabindex', '-1');

    root.style.cssText = [
      'all: initial',
      'position: fixed',
      `inset: 0`,
      `z-index: ${KC_ERASE_Z}`,
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'box-sizing: border-box',
      'font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      'font-size: 14px',
      'line-height: 1.4',
      'letter-spacing: normal',
      'text-align: center',
      'color: #f0f0f0',
      'background: rgba(0, 0, 0, 0.92)',
      'padding: 16px',
      'margin: 0',
      'border: none',
      'outline: none',
    ].join(';');

    const statusEl = document.createElement('div');
    statusEl.className = 'kc-erase-status';
    statusEl.style.cssText = [
      'box-sizing: border-box',
      'font-family: inherit',
      'font-size: 13px',
      'line-height: 1.4',
      'letter-spacing: normal',
      'text-align: center',
      'color: #cccccc',
      'margin: 0 0 12px 0',
      'padding: 0',
      'border: none',
      'background: transparent',
    ].join(';');

    const stageWrap = document.createElement('div');
    stageWrap.className = 'kc-erase-stage-wrap';
    stageWrap.style.cssText = [
      'box-sizing: border-box',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background: transparent',
    ].join(';');

    const stageCheckerBgImage =
      'linear-gradient(45deg, #d8d8d8 25%, transparent 25%, transparent 75%, #d8d8d8 75%), linear-gradient(45deg, #d8d8d8 25%, transparent 25%, transparent 75%, #d8d8d8 75%)';

    const stage = document.createElement('div');
    stage.className = 'kc-erase-stage';
    stage.style.cssText = [
      'box-sizing: border-box',
      'position: relative',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background-color: #333333',
      'touch-action: none',
      'user-select: none',
      '-webkit-user-select: none',
    ].join(';');

    const img = document.createElement('img');
    img.className = 'kc-erase-image';
    img.draggable = false;
    // PHASE_FIXED_STAGE: the checkerboard shows transparency in the image, so it sits
    // on the image rather than the stage — on the stage it covered the letterbox too.
    img.style.cssText = [
      'box-sizing: border-box',
      'display: none',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background-color: #ffffff',
      'background-size: 16px 16px',
      'background-position: 0 0, 8px 8px',
      'pointer-events: none',
      'max-width: none',
      'max-height: none',
    ].join(';');

    const spinnerEl = document.createElement('div');
    spinnerEl.className = 'kc-erase-spinner';
    spinnerEl.style.cssText = [
      'box-sizing: border-box',
      'position: absolute',
      'left: 50%',
      'top: 50%',
      'width: 40px',
      'height: 40px',
      'margin: -20px 0 0 -20px',
      'border: 3px solid rgba(255, 255, 255, 0.2)',
      'border-top-color: #BC13FE',
      'border-radius: 50%',
      'pointer-events: none',
    ].join(';');

    const spinAnim = spinnerEl.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 900, iterations: Infinity }
    );

    const strokeCanvas = document.createElement('canvas');
    strokeCanvas.className = 'kc-erase-stroke-canvas';
    strokeCanvas.style.cssText = [
      'box-sizing: border-box',
      'position: absolute',
      'left: 0',
      'top: 0',
      'pointer-events: none',
      'z-index: 3',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background: transparent',
    ].join(';');

    const toolbar = document.createElement('div');
    toolbar.className = 'kc-erase-toolbar';
    toolbar.style.cssText = [
      'box-sizing: border-box',
      'display: flex',
      'flex-wrap: wrap',
      'gap: 24px',
      'align-items: center',
      'justify-content: space-between',
      'width: 100%',
      'margin: 0 0 16px 0',
      'padding: 0',
      'border: none',
      'background: transparent',
      'font-family: inherit',
      'font-size: 14px',
      'line-height: 1.4',
      'letter-spacing: normal',
      'text-align: center',
      'color: inherit',
    ].join(';');

    const bottomBar = document.createElement('div');
    bottomBar.className = 'kc-erase-bottom-bar';
    bottomBar.style.cssText = [
      'box-sizing: border-box',
      'display: flex',
      'gap: 8px',
      'align-items: center',
      'justify-content: space-between',
      'margin: 12px 0 0 0',
      'padding: 0',
      'border: none',
      'background: transparent',
      'min-height: 36px',
    ].join(';');

    const groupStyle = [
      'box-sizing: border-box',
      'display: flex',
      'gap: 8px',
      'align-items: center',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background: transparent',
    ].join(';');

    const btnStyle = [
      'box-sizing: border-box',
      'font-family: inherit',
      'font-size: 14px',
      'line-height: 1.4',
      'letter-spacing: normal',
      'text-align: center',
      'color: #f0f0f0',
      'border-width: 1px',
      'border-style: solid',
      'border-radius: 6px',
      'padding: 8px 14px',
      'margin: 0',
      'cursor: pointer',
      'appearance: none',
      '-webkit-appearance: none',
    ].join(';');

    const iconTextBtnStyle = btnStyle + ';display:inline-flex;align-items:center;gap:6px;white-space:nowrap';

    const modeBtnStyle = btnStyle + ';display:flex;align-items:center;justify-content:center;padding:8px;';

    const brushCursor = document.createElement('div');
    brushCursor.className = 'kc-erase-brush-cursor';
    brushCursor.style.cssText = [
      'box-sizing: border-box',
      'position: absolute',
      'left: 0',
      'top: 0',
      'margin: 0',
      'padding: 0',
      'border-radius: 50%',
      'pointer-events: none',
      'z-index: 6',
      'display: none',
      'will-change: transform',
      'background: rgba(188, 19, 254, 0.35)',
      'border: 1px solid rgba(255, 255, 255, 0.85)',
      'box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45)',
    ].join(';');

    const btnModeBrush = document.createElement('button');
    btnModeBrush.type = 'button';
    btnModeBrush.className = 'kc-erase-btn kc-erase-btn--tool kc-erase-btn-mode-brush';
    btnModeBrush.innerHTML = KC_ICON_BRUSH;
    btnModeBrush.title = 'Brush';
    btnModeBrush.setAttribute('aria-label', 'Brush selection');
    btnModeBrush.style.cssText = modeBtnStyle;

    const btnModeRect = document.createElement('button');
    btnModeRect.type = 'button';
    btnModeRect.className = 'kc-erase-btn kc-erase-btn--tool kc-erase-btn-mode-rect';
    btnModeRect.innerHTML = KC_ICON_BOX;
    btnModeRect.title = 'Box';
    btnModeRect.setAttribute('aria-label', 'Box selection');
    btnModeRect.style.cssText = modeBtnStyle;

    const sizeSliderWrap = document.createElement('div');
    sizeSliderWrap.className = 'kc-erase-size-slider-wrap';
    sizeSliderWrap.style.cssText = [
      'box-sizing: border-box',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background: transparent',
      'font-family: inherit',
      'font-size: 14px',
      'line-height: 1.4',
      'color: inherit',
    ].join(';');

    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'kc-erase-size-label';
    sizeLabel.textContent = String(brushSize);
    sizeLabel.style.cssText = [
      'box-sizing: border-box',
      'width: 24px',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background: transparent',
      'font-family: inherit',
      'font-size: 14px',
      'line-height: 1.4',
      'text-align: right',
      'color: inherit',
    ].join(';');

    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.className = 'kc-erase-size-slider';
    sizeSlider.min = String(KC_BRUSH_MIN);
    sizeSlider.max = String(KC_BRUSH_MAX);
    sizeSlider.value = String(brushSize);
    sizeSlider.style.cssText = [
      'box-sizing: border-box',
      'width: 120px',
      'height: 20px',
      'margin: 0 4px',
      'padding: 0',
      'background: transparent',
      'accent-color: #BC13FE',
      'appearance: none',
      '-webkit-appearance: none',
      'cursor: pointer',
      'font-family: inherit',
      'font-size: 14px',
      'line-height: 1.4',
      'color: inherit',
    ].join(';');

    sizeSliderWrap.append(sizeLabel, sizeSlider);

    const boxHintEl = document.createElement('div');
    boxHintEl.className = 'kc-erase-box-hint';
    boxHintEl.textContent = 'Drag to select an area to erase';
    boxHintEl.style.cssText = [
      'box-sizing: border-box',
      'display: none',
      'color: #ffffff',
      'font-family: inherit',
      'font-size: 15px',
      'font-weight: 600',
      'line-height: 1.4',
      'letter-spacing: normal',
      'white-space: nowrap',
      'background: transparent',
      'border: none',
      'margin: 0',
      'padding: 0',
    ].join(';');

    const btnRefresh = document.createElement('button');
    btnRefresh.type = 'button';
    btnRefresh.className = 'kc-erase-btn kc-erase-btn--tool kc-erase-btn-refresh';
    btnRefresh.innerHTML = KC_ICON_REFRESH + '<span>Refresh</span>';
    btnRefresh.style.cssText = iconTextBtnStyle;
    btnRefresh.style.display = 'inline-flex';
    btnRefresh.style.visibility = 'hidden';

    const btnUndo = document.createElement('button');
    btnUndo.type = 'button';
    btnUndo.className = 'kc-erase-btn kc-erase-btn--tool kc-erase-btn-undo';
    btnUndo.innerHTML = KC_ICON_BACK + '<span>' + KC_BACK_LABEL + '</span>';
    btnUndo.style.cssText = iconTextBtnStyle;
    btnUndo.style.display = 'inline-flex';
    btnUndo.style.visibility = 'hidden';

    const btnBg = document.createElement('button');
    btnBg.type = 'button';
    btnBg.className = 'kc-erase-btn kc-erase-btn--primary kc-erase-btn-bg';
    btnBg.innerHTML = KC_ICON_REMOVEBG + '<span>Remove BG</span>';
    btnBg.style.cssText = iconTextBtnStyle;
    btnBg.style.display = 'inline-flex';
    btnBg.style.visibility = 'hidden';

    const btnUpscale = document.createElement('button');
    btnUpscale.type = 'button';
    btnUpscale.className = 'kc-erase-btn kc-erase-btn--primary kc-erase-btn-upscale';
    btnUpscale.innerHTML = KC_ICON_UPSCALE + '<span>Upscale</span>';
    btnUpscale.style.cssText = iconTextBtnStyle;
    btnUpscale.style.display = 'inline-flex';
    btnUpscale.style.visibility = 'hidden';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'kc-erase-btn kc-erase-btn--cancel kc-erase-btn-cancel';
    btnCancel.textContent = 'Esc to cancel';
    btnCancel.style.cssText = [
      btnStyle,
      'padding:8px 6px',
      'position:absolute',
      'top:16px',
      'right:16px',
      'z-index:7',
    ].join(';');

    const btnDone = document.createElement('button');
    btnDone.type = 'button';
    btnDone.className = 'kc-erase-btn kc-erase-btn--primary kc-erase-btn-done';
    btnDone.style.cssText = iconTextBtnStyle;

    stage.appendChild(img);
    stage.appendChild(spinnerEl);
    stage.appendChild(strokeCanvas);
    stage.appendChild(brushCursor);
    // PHASE_BUSY_OVERLAY: a non-rotating wrapper with the ring as a child, so the caption
    // stays upright. z-index 4 puts it over the selection overlay (3) — a mask drawn just
    // before Remove would otherwise sit on top of it — and under the brush cursor (6),
    // which is hidden while busy anyway.
    const busyEl = document.createElement('div');
    busyEl.className = 'kc-erase-busy';
    busyEl.style.cssText = [
      'box-sizing: border-box',
      'position: absolute',
      'left: 0',
      'top: 0',
      'width: 100%',
      'height: 100%',
      'display: none',
      'flex-direction: column',
      'align-items: center',
      'justify-content: center',
      'gap: 14px',
      'margin: 0',
      'padding: 0',
      'border: none',
      'pointer-events: none',
      'z-index: 4',
      'background: rgba(0, 0, 0, 0.45)',
    ].join(';');

    const busyRing = document.createElement('div');
    busyRing.className = 'kc-erase-busy-ring';
    busyRing.style.cssText = [
      'box-sizing: border-box',
      'width: 40px',
      'height: 40px',
      'margin: 0',
      'padding: 0',
      'border: 3px solid rgba(255, 255, 255, 0.2)',
      'border-top-color: #BC13FE',
      'border-radius: 50%',
      'flex: 0 0 auto',
    ].join(';');

    const busyText = document.createElement('div');
    busyText.className = 'kc-erase-busy-text';
    busyText.style.cssText = [
      'box-sizing: border-box',
      'font-family: inherit',
      'font-size: 14px',
      'font-weight: 600',
      'line-height: 1.4',
      'letter-spacing: normal',
      'text-align: center',
      'color: #ffffff',
      'margin: 0',
      'padding: 0',
      'border: none',
      'background: transparent',
      'white-space: nowrap',
    ].join(';');

    busyEl.append(busyRing, busyText);
    stage.appendChild(busyEl);

    let busyRingAnim = null;

    // PHASE_BUSY_OVERLAY: the ring's rotation runs only while shown. spinAnim, the one on
    // spinnerEl, is cancelled for good after the first load and cannot be borrowed.
    function showBusyOverlay(text) {
      busyText.textContent = text || '';
      busyEl.style.display = 'flex';
      if (!busyRingAnim) {
        try {
          busyRingAnim = busyRing.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
            { duration: 900, iterations: Infinity },
          );
        } catch (_) {}
      }
    }

    function hideBusyOverlay() {
      busyEl.style.display = 'none';
      if (busyRingAnim) {
        try { busyRingAnim.cancel(); } catch (_) {}
        busyRingAnim = null;
      }
    }

    const leftGroup = document.createElement('div');
    leftGroup.className = 'kc-erase-toolbar-left';
    leftGroup.style.cssText = groupStyle;

    const rightGroup = document.createElement('div');
    rightGroup.className = 'kc-erase-toolbar-right';
    rightGroup.style.cssText = groupStyle;

    leftGroup.append(btnModeBrush, btnModeRect, sizeSliderWrap, boxHintEl);
    rightGroup.append(btnBg);
    toolbar.append(leftGroup, rightGroup);
    // PHASE_FIXED_STAGE: the bar is space-between, so every direct child gets its own
    // slot. Back and Refresh are one pair and Upscale and Clip another, which leaves two
    // children and puts each pair at an end.
    const bottomLeftGroup = document.createElement('div');
    bottomLeftGroup.className = 'kc-erase-bottom-left';
    bottomLeftGroup.style.cssText = groupStyle;
    bottomLeftGroup.append(btnUndo, btnRefresh);

    const bottomRightGroup = document.createElement('div');
    bottomRightGroup.className = 'kc-erase-bottom-right';
    bottomRightGroup.style.cssText = groupStyle;
    // PHASE_SR_LIMIT: a disabled button gets no pointer events, so its own title would
    // never show. The wrapper stays interactive and carries the tooltip instead.
    const upscaleWrap = document.createElement('span');
    upscaleWrap.className = 'kc-erase-upscale-wrap';
    upscaleWrap.style.cssText = 'box-sizing:border-box;display:inline-flex;align-items:center;margin:0;padding:0;border:none;background:transparent';
    upscaleWrap.append(btnUpscale);
    bottomRightGroup.append(upscaleWrap, btnDone);
    bottomBar.append(bottomLeftGroup, bottomRightGroup);
    stageWrap.append(toolbar, stage, statusEl, bottomBar);

    const styleEl = document.createElement('style');
    styleEl.textContent = `
    .kc-erase-btn {
      background: #333333 !important;
      border-color: #555555 !important;
    }
    .kc-erase-btn--tool:not(:disabled):hover {
      background: #7C1FA8 !important;
      border-color: #BC13FE !important;
    }
    .kc-erase-btn--tool.kc-erase-btn--on {
      background: #BC13FE !important;
      border-color: transparent !important;
      font-weight: 600;
    }
    .kc-erase-btn--tool.kc-erase-btn--on:not(:disabled):hover {
      background: #BC13FE !important;
      border-color: transparent !important;
    }
    .kc-erase-btn--primary {
      background: #7C1FA8 !important;
      border-color: #BC13FE !important;
    }
    .kc-erase-btn--primary:not(:disabled):hover {
      background: #BC13FE !important;
      border-color: transparent !important;
    }
    .kc-erase-btn--cancel {
      background: transparent !important;
      border-color: transparent !important;
    }
    .kc-erase-btn--cancel:not(:disabled):hover {
      background: #C0392B !important;
      border-color: transparent !important;
    }
    .kc-erase-size-slider { -webkit-appearance: none; appearance: none; background: transparent; }
    .kc-erase-size-slider::-webkit-slider-runnable-track {
      height: 4px; border-radius: 2px; background: rgba(255,255,255,0.35);
    }
    .kc-erase-size-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 14px; height: 14px; margin-top: -5px;
      border-radius: 50%; background: #BC13FE;
      border: 2px solid #ffffff; cursor: pointer;
    }
  `;
    root.append(btnCancel, stageWrap, styleEl);
    document.documentElement.appendChild(root);

    function hasSelection() {
      return selections.length > 0;
    }

    function updateModeToggleUi() {
      btnModeBrush.classList.toggle('kc-erase-btn--on', mode === 'brush');
      btnModeRect.classList.toggle('kc-erase-btn--on', mode === 'rect');
      sizeSliderWrap.style.display = mode === 'brush' ? 'flex' : 'none';
      boxHintEl.style.display =
        (mode === 'rect' && originalBlob && current === originalBlob
         && !draft && !hasSelection())
          ? 'block' : 'none';
    }

    function setMode(next) {
      if (mode === next) return;
      mode = next;
      statusOverride = '';
      draft = null;
      renderSelections();
      updateModeToggleUi();
      updateUi();
      updateStageCursor();
      refreshBrushCursor();
    }

    if (typeof bindStatus === 'function') {
      try {
        bindStatus((text) => {
          if (settled || !loading) return;
          const t = String(text || '').trim();
          if (!t) return;
          statusText = t;
          updateUi();
        });
      } catch (_) {}
    }

    const allButtons = [btnRefresh, btnUndo, btnBg, btnUpscale, btnCancel, btnDone, btnModeBrush, btnModeRect];

    function finish(action) {
      if (settled) return;
      settled = true;
      try { spinAnim.cancel(); } catch (_) {}
      cancelReveal(); // PHASE_REVEAL
      hideBusyOverlay(); // PHASE_BUSY_OVERLAY
      if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
        blobUrl = null;
      }
      try { root.remove(); } catch (_) {}
      window.removeEventListener('resize', layoutImage);
      window.removeEventListener('keydown', onOverlayKeydown, true);
      if (prevOverflow) {
        document.documentElement.style.overflow = prevOverflow;
      } else {
        document.documentElement.style.removeProperty('overflow');
      }
      resolve({
        action,
        blob: action === 'cancel'
          ? (loading ? null : originalBlob)
          : current,
        modified: current !== originalBlob,
        bgRemoved: current !== originalBlob && bgApplied,
        erased: current !== originalBlob && eraseApplied,
        upscaled: current !== originalBlob && srApplied,
      });
    }
    finishRef = finish;

    function setButtonDisabled(btn, disabled) {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.45' : '1';
      btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    function updateStageCursor() {
      if (!stage) return;
      if (loading || busy) { stage.style.cursor = 'default'; return; }
      stage.style.cursor = (mode === 'brush') ? 'none' : 'default';
    }

    function moveBrushCursor(e) {
      if (!brushCursor) return;
      const p = pointerToLocal(e);
      brushCursorPt = p;
      brushCursor.style.transform =
        `translate(${Math.round(p.x - brushSize / 2)}px, ${Math.round(p.y - brushSize / 2)}px)`;
    }

    function sizeBrushCursor() {
      if (!brushCursor) return;
      brushCursor.style.width = `${brushSize}px`;
      brushCursor.style.height = `${brushSize}px`;
      if (brushCursorPt) {
        brushCursor.style.transform =
          `translate(${Math.round(brushCursorPt.x - brushSize / 2)}px, ${Math.round(brushCursorPt.y - brushSize / 2)}px)`;
      }
    }

    function refreshBrushCursor() {
      if (!brushCursor) return;
      const want = !!(mode === 'brush' && pointerInside && !loading && !busy && !settled);
      brushCursor.style.display = want ? 'block' : 'none';
    }

    function setDoneButton(icon, label) {
      btnDone.innerHTML = icon + '<span>' + label + '</span>';
    }

    function setBgButton(icon, label) {
      btnBg.innerHTML = icon + '<span>' + label + '</span>';
    }

    setDoneButton(KC_ICON_CLIP, KC_CLIP_LABEL);
    setBgButton(KC_ICON_REMOVEBG, 'Remove BG');

    // PHASE_SR_LIMIT: false while the ceiling is unknown, so the button starts usable.
    function _srcExceedsLimit() {
      if (!srMaxOutPx || !srcW || !srcH) return false;
      return (srcW * srcH) > srMaxOutPx;
    }

    function updateUi() {
      if (loading) {
        statusEl.style.display = 'block';
        statusEl.textContent = statusText;
        img.style.backgroundImage = 'none';
        btnRefresh.style.visibility = 'hidden';
        btnUndo.style.visibility = 'hidden';
        btnBg.style.visibility = 'hidden';
        btnUpscale.style.visibility = 'hidden';
        btnDone.style.display = 'none';
        btnCancel.style.display = 'inline-block';
        btnModeBrush.style.display = 'none';
        btnModeRect.style.display = 'none';
        sizeSliderWrap.style.display = 'none';
        boxHintEl.style.display = 'none';
        setButtonDisabled(btnCancel, false);
        updateStageCursor();
        refreshBrushCursor();
        return;
      }

      img.style.backgroundImage = stageCheckerBgImage;

      if (statusOverride) {
        statusEl.style.display = 'block';
        statusEl.textContent = statusOverride;
      } else {
        statusEl.style.display = 'none';
      }

      btnModeBrush.style.display = 'inline-block';
      btnModeRect.style.display = 'inline-block';
      updateModeToggleUi();

      btnRefresh.style.visibility = (originalBlob && current !== originalBlob) ? 'visible' : 'hidden';
      btnUndo.style.visibility = history.length > 0 ? 'visible' : 'hidden';
      if (!bgFn) {
        btnBg.style.visibility = 'hidden';
      } else {
        btnBg.style.visibility = 'visible';
        if (busy) {
          if (hasSelection()) {
            setBgButton(KC_ICON_ERASE, KC_REMOVING_LABEL);
          } else {
            setBgButton(KC_ICON_REMOVEBG, KC_REMOVING_BG_LABEL);
          }
        } else if (hasSelection()) {
          setBgButton(KC_ICON_ERASE, KC_REMOVE_LABEL);
        } else {
          setBgButton(KC_ICON_REMOVEBG, 'Remove BG');
        }
      }
      // PHASE_SR_BUTTON: hidden when the caller supplied no upscaleFn, the same way
      // btnBg is hidden without bgFn.
      btnUpscale.style.visibility = upscaleFn ? 'visible' : 'hidden';
      btnCancel.style.display = 'inline-block';
      btnDone.style.display = 'inline-flex';
      setDoneButton(KC_ICON_CLIP, KC_CLIP_LABEL);

      for (const btn of allButtons) {
        if (btn === btnCancel) continue;
        if (btn === btnBg) {
          setButtonDisabled(btnBg, busy || (bgApplied && !hasSelection()));
          continue;
        }
        if (btn === btnUpscale) {
          // PHASE_SR_LIMIT: past srMaxOutPx an upscale returns less than it was given —
          // the source is shrunk to the ceiling and only that fraction is enlarged. The
          // hint is set on every pass so it cannot outlive the reason: an undo restores a
          // smaller image, and the button becomes usable again.
          const overLimit = _srcExceedsLimit();
          setButtonDisabled(btnUpscale, busy || srApplied || overLimit);
          upscaleWrap.title = overLimit ? KC_UPSCALE_LIMIT_HINT : '';
          continue;
        }
        if (btn === btnDone) {
          setButtonDisabled(btnDone, busy || hasSelection());
          continue;
        }
        setButtonDisabled(btn, busy);
      }
      setButtonDisabled(btnCancel, false);
      updateStageCursor();
      refreshBrushCursor();
    }

    function setBgActionBtnBusy(isBusy) {
      if (isBusy) {
        setBgButton(KC_ICON_ERASE, KC_REMOVING_LABEL);
        btnBg.style.cursor = 'default';
        btnBg.disabled = true;
        return;
      }
      btnBg.style.cursor = 'pointer';
      btnBg.disabled = false;
    }

    function renderSelections() {
      const ctx = strokeCanvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);

      function drawStroke(stroke) {
        if (!stroke.points.length) return;
        const lw = stroke.size * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        ctx.strokeStyle = 'rgba(188, 19, 254, 0.35)';
        ctx.fillStyle = 'rgba(188, 19, 254, 0.35)';
        if (stroke.points.length === 1) {
          const p = stroke.points[0];
          ctx.beginPath();
          ctx.arc(p.x * scale + offX, p.y * scale + offY, lw / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x * scale + offX, stroke.points[0].y * scale + offY);
          for (let i = 1; i < stroke.points.length; i += 1) {
            ctx.lineTo(stroke.points[i].x * scale + offX, stroke.points[i].y * scale + offY);
          }
          ctx.stroke();
        }
      }

      function drawRectSource(r) {
        const x = r.x * scale + offX;
        const y = r.y * scale + offY;
        const w = r.w * scale;
        const h = r.h * scale;
        ctx.fillStyle = 'rgba(188, 19, 254, 0.35)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#BC13FE';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }

      function drawRectDisplay(d) {
        ctx.fillStyle = 'rgba(188, 19, 254, 0.35)';
        ctx.fillRect(d.dx, d.dy, d.dw, d.dh);
        ctx.strokeStyle = '#BC13FE';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.dx, d.dy, d.dw, d.dh);
      }

      for (const entry of selections) {
        if (entry.type === 'stroke') drawStroke(entry);
        else if (entry.type === 'rect') drawRectSource(entry);
      }
      if (activeStroke) drawStroke(activeStroke);
      if (draft) drawRectDisplay(draft);
    }


    /** Convert display-space rect (relative to image top-left) to source-image pixels. */
    function displayToSource(dx, dy, dw, dh) {
      const x = Math.round((dx - offX) / scale);
      const y = Math.round((dy - offY) / scale);
      const w = Math.round(dw / scale);
      const h = Math.round(dh / scale);
      const cx = Math.max(0, Math.min(x, srcW));
      const cy = Math.max(0, Math.min(y, srcH));
      const x2 = Math.max(0, Math.min(x + w, srcW));
      const y2 = Math.max(0, Math.min(y + h, srcH));
      return { x: cx, y: cy, w: Math.max(0, x2 - cx), h: Math.max(0, y2 - cy) };
    }

    function normalizeDisplayRect(x0, y0, x1, y1) {
      const dx = Math.min(x0, x1);
      const dy = Math.min(y0, y1);
      const dw = Math.abs(x1 - x0);
      const dh = Math.abs(y1 - y0);
      return { dx, dy, dw, dh };
    }

    function finalizeDraft() {
      if (!draft) return;
      const src = displayToSource(draft.dx, draft.dy, draft.dw, draft.dh);
      if (src.w >= 8 && src.h >= 8) {
        selections.push({ type: 'rect', x: src.x, y: src.y, w: src.w, h: src.h });
      }
      draft = null;
      renderSelections();
      updateUi();
    }

    // PHASE_REVEAL: `prev` is the outgoing image's URL and its geometry as it was laid
    // out. The copy is pinned at exactly those coordinates so it sits over the new image
    // without moving, and clip-path retracts its right edge to the left.
    function playReveal(prev) {
      if (!prev || !prev.url || settled || !prev.w || !prev.h) {
        if (prev && prev.url) { try { URL.revokeObjectURL(prev.url); } catch (_) {} }
        return Promise.resolve();
      }
      cancelReveal();
      revealUrl = prev.url;
      revealEl = document.createElement('img');
      revealEl.className = 'kc-erase-reveal';
      revealEl.src = prev.url;
      revealEl.style.cssText = [
        'box-sizing: border-box',
        'position: absolute',
        `left: ${prev.x}px`,
        `top: ${prev.y}px`,
        `width: ${prev.w}px`,
        `height: ${prev.h}px`,
        'margin: 0',
        'padding: 0',
        'border: none',
        'pointer-events: none',
        'z-index: 1',
        'background-color: #ffffff',
        'background-size: 16px 16px',
        'background-position: 0 0, 8px 8px',
      ].join(';');
      revealEl.style.backgroundImage = stageCheckerBgImage;
      stage.appendChild(revealEl);
      revealBar = document.createElement('div');
      revealBar.className = 'kc-erase-reveal-bar';
      revealBar.style.cssText = [
        'box-sizing: border-box',
        'position: absolute',
        `left: ${prev.x}px`,
        `top: ${prev.y}px`,
        'width: 3px',
        `height: ${prev.h}px`,
        'margin: 0',
        'padding: 0',
        'border: none',
        'pointer-events: none',
        'z-index: 2',
        'background: #BC13FE',
        'box-shadow: 0 0 12px rgba(188, 19, 254, 0.9)',
        'will-change: transform',
      ].join(';');
      stage.appendChild(revealBar);
      return new Promise((res) => {
        let done = false;
        const finishReveal = () => {
          if (done) return;
          done = true;
          cancelReveal();
          res();
        };
        try {
          revealAnim = revealEl.animate(
            [
              { clipPath: 'inset(0 0 0 0)' },
              { clipPath: 'inset(0 100% 0 0)' },
            ],
            { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
          );
          // PHASE_REVEAL: same duration and easing as the clip, so the bar stays on the
          // edge rather than drifting ahead of or behind it.
          revealBarAnim = revealBar.animate(
            [
              { transform: `translateX(${prev.w}px)`, opacity: 1 },
              { transform: 'translateX(0px)', opacity: 1 },
            ],
            { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
          );
          revealAnim.onfinish = finishReveal;
          revealAnim.oncancel = finishReveal;
        } catch (_) {
          finishReveal();
        }
      });
    }

    // PHASE_REVEAL: tears the copy down and frees the URL it was holding. Safe to call
    // twice, and called from finish() so a mid-wipe close leaks nothing.
    function cancelReveal() {
      if (revealAnim) {
        try { revealAnim.onfinish = null; revealAnim.oncancel = null; revealAnim.cancel(); } catch (_) {}
        revealAnim = null;
      }
      if (revealBarAnim) {
        try { revealBarAnim.cancel(); } catch (_) {}
        revealBarAnim = null;
      }
      if (revealBar) {
        try { revealBar.remove(); } catch (_) {}
        revealBar = null;
      }
      if (revealEl) {
        try { revealEl.remove(); } catch (_) {}
        revealEl = null;
      }
      if (revealUrl) {
        try { URL.revokeObjectURL(revealUrl); } catch (_) {}
        revealUrl = null;
      }
    }

    function loadBlobIntoImage(nextBlob) {
      return new Promise((res, rej) => {
        const prev = {
          url: blobUrl,
          w: parseFloat(img.style.width) || 0,
          h: parseFloat(img.style.height) || 0,
          x: parseFloat(img.style.marginLeft) || 0,
          y: parseFloat(img.style.marginTop) || 0,
        };
        const nextUrl = URL.createObjectURL(nextBlob);
        img.onload = () => {
          srcW = img.naturalWidth || 1;
          srcH = img.naturalHeight || 1;
          // PHASE_REVEAL: the caller may be holding prevUrl for a wipe, so it is handed
          // back rather than revoked here. Callers that do not animate revoke it at once.
          blobUrl = nextUrl;
          layoutImage();
          res(prev);
        };
        img.onerror = () => {
          try { URL.revokeObjectURL(nextUrl); } catch (_) {}
          rej(new Error('image load failed'));
        };
        img.src = nextUrl;
      });
    }

    async function undoLast() {
      if (busy || loading || history.length === 0 || !current) return;
      busy = true;
      updateUi();
      current = history.pop();
      bgApplied = bgHistory.length > 0 ? bgHistory.pop() : false;
      eraseApplied = eraseHistory.length > 0 ? eraseHistory.pop() : false;
      srApplied = srHistory.length > 0 ? srHistory.pop() : false;
      draft = null;
      selections = [];
      activeStroke = null;
      try {
        const _prev = await loadBlobIntoImage(current);
        if (_prev && _prev.url) { try { URL.revokeObjectURL(_prev.url); } catch (_) {} }
        if (settled) return;
        renderSelections();
      } catch (_) {
        if (settled) return;
        finish('cancel');
        return;
      } finally {
        busy = false;
        if (!settled) {
          updateUi();
        }
      }
    }

    async function resetToOriginal() {
      if (busy || loading || !originalBlob || current === originalBlob) return;
      busy = true;
      updateUi();
      history.push(current);
      bgHistory.push(bgApplied);
      eraseHistory.push(eraseApplied);
      srHistory.push(srApplied);
      current = originalBlob;
      bgApplied = false;
      eraseApplied = false;
      srApplied = false;
      draft = null;
      selections = [];
      activeStroke = null;
      try {
        const _prev = await loadBlobIntoImage(current);
        if (_prev && _prev.url) { try { URL.revokeObjectURL(_prev.url); } catch (_) {} }
        if (settled) return;
        renderSelections();
      } catch (_) {
        if (settled) return;
        finish('cancel');
        return;
      } finally {
        busy = false;
        if (!settled) {
          updateUi();
        }
      }
    }

    async function buildMaskBlob() {
      if (!srcW || !srcH || !selections.length) return null;
      const c = new OffscreenCanvas(srcW, srcH);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, srcW, srcH);
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const entry of selections) {
        if (entry.type === 'rect') {
          ctx.fillRect(entry.x, entry.y, entry.w, entry.h);
        } else if (entry.type === 'stroke') {
          if (!entry.points.length) continue;
          ctx.lineWidth = entry.size;
          if (entry.points.length === 1) {
            const p = entry.points[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, entry.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(entry.points[0].x, entry.points[0].y);
            for (let i = 1; i < entry.points.length; i += 1) {
              ctx.lineTo(entry.points[i].x, entry.points[i].y);
            }
            ctx.stroke();
          }
        }
      }
      return await c.convertToBlob({ type: 'image/png' });
    }

    function blobToDataURL(blob) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
    }

    async function runRemove() {
      if (busy || loading || !current || !hasSelection()) return;
      const maskBlob = await buildMaskBlob();
      if (!maskBlob) return;

      statusOverride = '';
      busy = true;
      showBusyOverlay(KC_BUSY_REMOVING); // PHASE_BUSY_OVERLAY
      setBgActionBtnBusy(true);
      updateUi();
      let inferenceFailed = false;
      let removeSucceeded = false;
      try {
        const maskDataUrl = await blobToDataURL(maskBlob);
        const out = await inpaintFn(current, maskDataUrl);
        if (settled) return;
        if (!out) {
          inferenceFailed = true;
          return;
        }
        removeSucceeded = true;
        statusOverride = '';
        history.push(current);
        bgHistory.push(bgApplied);
        eraseHistory.push(eraseApplied);
        srHistory.push(srApplied);
        current = out;
        eraseApplied = true;
        draft = null;
        selections = [];
        activeStroke = null;
        hideBusyOverlay(); // PHASE_BUSY_OVERLAY
        try {
          await playReveal(await loadBlobIntoImage(current));
          if (settled) return;
        } catch (_) {
          /* inference succeeded; reload failure leaves committed state, no false hint */
        }
      } catch (_) {
        if (settled) return;
        inferenceFailed = true;
      } finally {
        hideBusyOverlay(); // PHASE_BUSY_OVERLAY
        if (settled) {
          busy = false;
          return;
        }
        busy = false;
        setBgActionBtnBusy(false);
        renderSelections();
        if (inferenceFailed) {
          statusOverride = 'Removing failed — try a smaller area';
        }
        updateUi();
      }
    }

    async function runBgRemove() {
      if (busy || loading || bgApplied || !current || !bgFn) return;
      busy = true;
      statusOverride = '';
      showBusyOverlay(KC_BUSY_REMOVING); // PHASE_BUSY_OVERLAY
      updateUi();
      let failed = '';
      try {
        const out = await bgFn(current);
        if (settled) return;
        if (out instanceof Blob) {
          history.push(current);
          bgHistory.push(bgApplied);
          eraseHistory.push(eraseApplied);
          srHistory.push(srApplied);
          current = out;
          bgApplied = true;
          draft = null;
          selections = [];
          activeStroke = null;
          hideBusyOverlay(); // PHASE_BUSY_OVERLAY
          try { await playReveal(await loadBlobIntoImage(current)); } catch (_) {}
          if (settled) return;
        } else {
          failed = (out && out.error) || 'failed';
        }
      } catch (_) {
        failed = 'failed';
      } finally {
        hideBusyOverlay(); // PHASE_BUSY_OVERLAY
        busy = false;
        if (!settled) {
          if (failed) {
            statusOverride =
              failed === 'signed-out' ? 'Sign in to remove backgrounds'
              : failed === 'http-429' ? 'Daily background removal limit reached'
              : 'Background removal failed';
          }
          updateUi();
          renderSelections();
        }
      }
    }

    // PHASE_SR_BUTTON: modelled on runBgRemove. One pass, one press per session; the
    // megapixel loop belongs to the automatic path, where nobody chose to run it. A
    // source over the provider ceiling is shrunk to the ceiling by the offscreen side,
    // exactly as the clip pipeline does it.
    async function runUpscale() {
      if (busy || loading || srApplied || !current || !upscaleFn) return;
      if (_srcExceedsLimit()) return; // PHASE_SR_LIMIT
      busy = true;
      statusOverride = '';
      showBusyOverlay(KC_BUSY_UPSCALING); // PHASE_BUSY_OVERLAY
      updateUi();
      let failed = false;
      try {
        const out = await upscaleFn(current);
        if (settled) return;
        if (out instanceof Blob) {
          history.push(current);
          bgHistory.push(bgApplied);
          eraseHistory.push(eraseApplied);
          srHistory.push(srApplied);
          current = out;
          srApplied = true;
          draft = null;
          selections = [];
          activeStroke = null;
          hideBusyOverlay(); // PHASE_BUSY_OVERLAY
          try { await playReveal(await loadBlobIntoImage(current)); } catch (_) {}
          if (settled) return;
        } else {
          failed = true;
        }
      } catch (_) {
        failed = true;
      } finally {
        hideBusyOverlay(); // PHASE_BUSY_OVERLAY
        busy = false;
        if (!settled) {
          if (failed) statusOverride = 'Upscaling failed';
          updateUi();
          renderSelections();
        }
      }
    }

    function layoutImage() {
      const boxW = Math.round(window.innerWidth * 0.6);
      const boxH = Math.round(window.innerHeight * 0.6);
      stage.style.width = `${boxW}px`;
      stage.style.height = `${boxH}px`;
      toolbar.style.width = `${boxW}px`;
      bottomBar.style.width = `${boxW}px`;
      strokeCanvas.style.width = `${boxW}px`;
      strokeCanvas.style.height = `${boxH}px`;
      strokeCanvas.width = boxW;
      strokeCanvas.height = boxH;
      if (loading || !srcW || !srcH) {
        scale = 1; offX = 0; offY = 0;
        img.style.width = '0px';
        img.style.height = '0px';
        return;
      }
      // PHASE_FIXED_STAGE: contain without a cap — the image fills the box on whichever
      // axis binds. A small source is magnified, which looks soft, but a clip floating
      // small in the middle of a large panel looks broken.
      scale = Math.min(boxW / srcW, boxH / srcH);
      const dispW = Math.round(srcW * scale);
      const dispH = Math.round(srcH * scale);
      offX = Math.round((boxW - dispW) / 2);
      offY = Math.round((boxH - dispH) / 2);
      img.style.width = `${dispW}px`;
      img.style.height = `${dispH}px`;
      img.style.marginLeft = `${offX}px`;
      img.style.marginTop = `${offY}px`;
      renderSelections();
    }

    function pointerToLocal(e) {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return {
        x: Math.max(0, Math.min(x, rect.width)),
        y: Math.max(0, Math.min(y, rect.height)),
      };
    }

    /** Convert a stage pointer event to source-image pixel coordinates. */
    function pointerToSource(e) {
      const pt = pointerToLocal(e);
      return {
        x: Math.max(0, Math.min(Math.round((pt.x - offX) / scale), srcW)),
        y: Math.max(0, Math.min(Math.round((pt.y - offY) / scale), srcH)),
      };
    }

    let drawing = false;
    let startPt = null;
    let downX = 0;
    let downY = 0;
    let moved = false;
    let startedInsideStage = false;

    function pointerOnUiChrome(target) {
      return toolbar.contains(target)
        || bottomBar.contains(target)
        || statusEl.contains(target)
        || btnCancel === target
        || btnCancel.contains(target);
    }

    stage.addEventListener('pointerenter', (e) => {
      pointerInside = true;
      moveBrushCursor(e);
      refreshBrushCursor();
    });
    stage.addEventListener('pointerleave', () => {
      pointerInside = false;
      refreshBrushCursor();
    });

    root.addEventListener('pointerdown', (e) => {
      if (loading || e.button !== 0 || busy) return;
      if (pointerOnUiChrome(e.target)) return;
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
      startedInsideStage = stage.contains(e.target);
      e.preventDefault();
      e.stopPropagation();
      try { root.setPointerCapture(e.pointerId); } catch (_) {}
      drawing = true;
      if (mode === 'brush') {
        statusOverride = '';
        activeStroke = { size: brushSize / scale, points: [pointerToSource(e)] };
        renderSelections();
        updateUi();
        return;
      }
      statusOverride = '';
      startPt = pointerToLocal(e);
      draft = { dx: startPt.x, dy: startPt.y, dw: 0, dh: 0 };
      renderSelections();
      updateUi();
    });

    root.addEventListener('pointermove', (e) => {
      moveBrushCursor(e);
      if (drawing && !moved) {
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (dx * dx + dy * dy > 16) moved = true;
      }
      if (loading || !drawing || busy) return;
      e.preventDefault();
      e.stopPropagation();
      if (mode === 'brush') {
        if (!activeStroke) return;
        const pt = pointerToSource(e);
        const last = activeStroke.points[activeStroke.points.length - 1];
        if (last) {
          const dx = pt.x - last.x;
          const dy = pt.y - last.y;
          if (dx * dx + dy * dy < 1) return;
        }
        activeStroke.points.push(pt);
        renderSelections();
        return;
      }
      if (!startPt) return;
      const pt = pointerToLocal(e);
      draft = normalizeDisplayRect(startPt.x, startPt.y, pt.x, pt.y);
      renderSelections();
    });

    root.addEventListener('pointerup', (e) => {
      if (loading || !drawing || busy) return;
      e.preventDefault();
      e.stopPropagation();
      drawing = false;
      try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      try {
        const r = stage.getBoundingClientRect();
        pointerInside = e.clientX >= r.left && e.clientX <= r.right
                     && e.clientY >= r.top && e.clientY <= r.bottom;
      } catch (_) {}
      if (!moved) {
        if (!startedInsideStage && selections.length > 0) {
          selections.pop();
        }
        activeStroke = null;
        draft = null;
        startPt = null;
        renderSelections();
        updateUi();
        return;
      }
      if (mode === 'brush') {
        if (activeStroke && activeStroke.points.length > 0) {
          selections.push({ type: 'stroke', size: activeStroke.size, points: activeStroke.points });
        }
        activeStroke = null;
        startPt = null;
        renderSelections();
        updateUi();
        return;
      }
      startPt = null;
      finalizeDraft();
    });

    root.addEventListener('pointercancel', (e) => {
      if (loading || !drawing || busy) return;
      e.preventDefault();
      e.stopPropagation();
      drawing = false;
      try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      try {
        const r = stage.getBoundingClientRect();
        pointerInside = e.clientX >= r.left && e.clientX <= r.right
                     && e.clientY >= r.top && e.clientY <= r.bottom;
      } catch (_) {}
      if (mode === 'brush') {
        activeStroke = null;
        startPt = null;
        renderSelections();
        updateUi();
        return;
      }
      startPt = null;
      draft = null;
      renderSelections();
      updateUi();
    });

    function onOverlayKeydown(e) {
      if (settled) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish('cancel');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopPropagation();
        if (busy || loading) return;
        if (selections.length > 0) {
          selections.pop();
          renderSelections();
          updateUi();
          return;
        }
        if (history.length > 0) undoLast();
      }
    }
    window.addEventListener('keydown', onOverlayKeydown, true);

    btnModeBrush.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMode('brush');
    });
    btnModeRect.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMode('rect');
    });
    sizeSlider.addEventListener('input', () => {
      brushSize = Math.max(KC_BRUSH_MIN, Math.min(KC_BRUSH_MAX, Number(sizeSlider.value)));
      sizeLabel.textContent = String(brushSize);
      sizeBrushCursor();
    });
    btnRefresh.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetToOriginal();
    });
    btnUndo.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      undoLast();
    });
    btnBg.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy || loading) return;
      if (hasSelection()) { runRemove(); return; }
      runBgRemove();
    });
    btnUpscale.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy || loading) return;
      runUpscale();
    });
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      finish('cancel');
    });
    btnDone.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy || loading) return;
      if (!current) return;
      if (commitFn) { try { commitFn(current); } catch (_) {} }
      finish('done');
    });

    window.addEventListener('resize', layoutImage);

    layoutImage();
    sizeBrushCursor();
    updateModeToggleUi();
    try { root.focus(); } catch (_) {}
    updateUi();

      if (typeof srMaxPixelsFn === 'function') {
        srMaxPixelsFn().then((px) => {
          // PHASE_SR_LIMIT: x16 because the model is 4x on each axis.
          if (settled) return;
          const n = Number(px) || 0;
          if (n > 0) { srMaxOutPx = n * 16; updateUi(); }
        }).catch(() => {});
      }

    Promise.resolve(blob)
      .then(async (resolvedBlob) => {
        if (settled) return;
        if (!resolvedBlob) {
          finish('cancel');
          return;
        }
        loading = false;
        originalBlob = resolvedBlob;
        current = resolvedBlob;
        try { spinAnim.cancel(); } catch (_) {}
        spinnerEl.style.display = 'none';
        img.style.display = 'block';
        const _prev = await loadBlobIntoImage(current);
        if (_prev && _prev.url) { try { URL.revokeObjectURL(_prev.url); } catch (_) {} }
        if (settled) return;
        updateUi();
      })
      .catch(() => finish('cancel'));
  });
  p.cancelExternal = () => { try { if (finishRef) finishRef('cancel'); } catch (_) {} };
  return p;
}
