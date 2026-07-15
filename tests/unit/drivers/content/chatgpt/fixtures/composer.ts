export const CHATGPT_COMPOSER_FIXTURE_HTML = `
<form class="group/composer w-full">
  <div class="grid">
    <div class="self-center [grid-area:leading]">
      <div data-testid="official-tooltip-portal"></div>
      <span class="flex">
        <button id="composer-plus-btn" data-testid="composer-plus-btn" type="button" aria-label="Add photos and files"></button>
      </span>
    </div>
  </div>
  <div id="prompt-textarea" class="ProseMirror" contenteditable="true" role="textbox"><p><br></p></div>
</form>
`;
