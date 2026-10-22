export default `
    <div class="ghero card">
      <h1>Century VMS Booking Builder — User Guide</h1>
      <p>Turn your Amazon EPIC <b>SOURCE FILE</b> into a ready-to-upload booking workbook in under a minute. No formulas, no copy-paste.</p>
      <div class="gflow"><span>1 Upload</span><i>→</i><span>2 Check</span><i>→</i><span>3 Pick ECDD</span><i>→</i><span>4 Generate</span><i>→</i><span>5 Upload to Amazon</span></div>
    </div>

    <section class="gsec card" id="g-start" data-t="Quick start 5 steps"><h2>🚀 Quick start (5 steps)</h2>
      <ol class="gsteps">
        <li><b>Upload.</b> Drag your SOURCE FILE (.xlsx) onto the big drop zone, or click <i>browse</i>. The file must contain the sheets <code>BK</code> and <code>PurchaseOrderItems</code>.</li>
        <li><b>Read the AI Assistant.</b> It tells you how many keys matched, how many bookings were found, whether the BK sheet has a filter, and how many “Wrong CVC” lines exist. Orange messages need your attention.</li>
        <li><b>Choose ECDD dates.</b> Click the date cards (lit = selected). Each card shows bookings · POs · pieces. Use <i>Select all / Clear</i> for speed.</li>
        <li><b>Check the preview.</b> The table and the stat cards update live. Fix anything in <b>⚙ Settings</b> first if needed.</li>
        <li><b>Generate Excel.</b> The file downloads to your browser's Downloads folder. Watch the live timer; when it turns green you can download it again if needed.</li>
      </ol>
      <div class="tip">💡 Tip: you can drop a new file at any time with <b>↺ New file</b>. Your settings are remembered.</div>
    </section>

    <section class="gsec card" id="g-key" data-t="Primary key booking rule PO model ECDD factory ship"><h2>🔑 How bookings are decided (the booking rule)</h2>
      <p>The program first joins the <b>BK</b> sheet to <b>PurchaseOrderItems</b> using <code>PO – model – ECDD</code> and creates one output line per <b>ASIN</b>.</p>
      <p>Then lines that share the same values in <b>every ticked field</b> of the <i>booking rule</i> are counted as <b>one booking</b>. The default rule is:</p>
      <div class="gkey"><span>PO</span><i>–</i><span>model</span><i>–</i><span>ECDD</span><i>–</i><span>Factory</span><i>–</i><span>Ship</span></div>
      <p>Change it in <b>⚙ Settings → Booking condition</b>. The live box shows the new booking count immediately, e.g. <i>“→ 30 bookings from 4,022 ASIN lines”</i>.</p>
      <table class="gt"><tr><th>PO</th><th>model</th><th>ECDD</th><th>Factory</th><th>Ship</th><th>BOOKING COUNTING</th><th>BOOKING SERIAL</th></tr>
        <tr><td>15LM7W1S</td><td>AE1901530</td><td>29-Nov</td><td>EGMCL</td><td>ITHC</td><td>1</td><td>1</td></tr>
        <tr><td>15LM7W1S</td><td>AE1901530</td><td>29-Nov</td><td>EGMCL</td><td>ITHC</td><td>1</td><td></td></tr>
        <tr><td>15LM7W1S</td><td>AE190196</td><td>29-Nov</td><td>EGMCL</td><td>ITHC</td><td>2</td><td>2</td></tr>
        <tr><td>1HGRVX3B</td><td>AE190196</td><td>29-Nov</td><td>EGMCL</td><td>ITHC</td><td>3</td><td>3</td></tr></table>
      <ul><li><b>BOOKING COUNTING</b> — every line carries its booking’s number (1, 1, 1, 2, 2, 3 …).</li>
        <li><b>BOOKING SERIAL</b> — shows 1, 2, 3 … once per booking (first line only). The last number = total bookings.</li>
        <li>Both columns are live Excel formulas, so they stay correct if you edit or filter rows.</li></ul>
    </section>

    <section class="gsec card" id="g-filter" data-t="BK sheet filter checkbox"><h2>🧰 Use BK sheet filter</h2>
      <p>If you filtered the <b>BK</b> sheet in Excel (for example <i>PO Status = Correct PO</i> or a Booking Due month), Excel hides the other rows. The program detects this.</p>
      <table class="gt"><tr><th>Checkbox</th><th>What is booked</th></tr>
        <tr><td>☑ ticked (default)</td><td>Only the rows <b>visible</b> under your Excel filter.</td></tr>
        <tr><td>☐ unticked</td><td><b>All</b> uploaded BK rows, ignoring the filter.</td></tr></table>
      <p>Everything — ECDD cards, stats, preview, booking count, output sheets — switches instantly when you toggle it. If the sheet has no filter, the app says so and uses all rows.</p>
    </section>

    <section class="gsec card" id="g-cvc" data-t="Wrong CVC PO separate sheet"><h2>🟠 Wrong CVC POs</h2>
      <p>POs whose status is <b>“Wrong CVC PO”</b> cannot be booked under the vendor code they were received on. By default they are <b>moved to their own sheet</b>, <code>WRONG CVC PO</code>, so they never mix with the bookable POs.</p>
      <ul><li>The sheet has the same layout as the upload sheet, with Ship/Vendor Code and Factory shown <b>as received</b>, plus <b>Correct Factory will be</b> and <b>Action = Need CVC change</b>.</li>
        <li>It has its own booking numbering, using the same booking rule.</li>
        <li>Prefer one sheet? Untick <i>“Move Wrong CVC PO lines to a separate sheet”</i> in <b>⚙ Settings → Booking defaults</b>. They will then be booked under the corrected factory/vendor and shown in orange.</li></ul>
    </section>

    <section class="gsec card" id="g-out" data-t="Output workbook sheets"><h2>📄 What the output workbook contains</h2>
      <table class="gt"><tr><th>Sheet</th><th>Content</th></tr>
        <tr><td><b>UPLOAD FILE FORMAT USER</b></td><td>The booking upload sheet (Excel Table). One line per ASIN. Carton Qty, Gross/Net Weight and CBM are formulas.</td></tr>
        <tr><td><b>WRONG CVC PO</b></td><td>Only when Wrong CVC lines exist and separation is on (see above).</td></tr>
        <tr><td><b>BK</b></td><td>Copy of the BK rows that were used.</td></tr>
        <tr><td><b>PurchaseOrderItems</b></td><td>Copy of the PO item rows that were used.</td></tr></table>
      <p>The workbook recalculates itself when opened in Excel, so <b>WORKING DATE</b> always shows today’s date.</p>
    </section>

    <section class="gsec card" id="g-cols" data-t="Rearrange columns order"><h2>↔ Rearranging the output columns</h2>
      <p>Open <b>⚙ Settings → Output table columns</b>. <b>Drag</b> a column chip to a new place, or use its <b>◀ ▶</b> arrows. The numbers show the final column positions.</p>
      <ul><li>Default: <b>BOOKING SERIAL = column 3</b>, <b>BOOKING COUNTING = column 4</b> (highlighted).</li>
        <li>All formulas follow your order automatically.</li><li><b>Reset</b> restores the default order. Your order is remembered.</li></ul>
    </section>

    <section class="gsec card" id="g-defaults" data-t="Defaults ship mode freight incoterms weights"><h2>⚙ Booking defaults</h2>
      <table class="gt"><tr><th>Field</th><th>Meaning</th></tr>
        <tr><td>Ship Mode · Freight Type · Incoterms · FOB Port · Order Type</td><td>Constant values written on every line (pre-filled from your template: Ocean, CFS/CY, FOB, Chittagong, Denim Order).</td></tr>
        <tr><td>File</td><td>File reference such as <code>EG5-10325</code>. Left blank by default — type it before generating.</td></tr>
        <tr><td>Gross / Net weight per pc, CBM per pc</td><td>Multipliers used in the weight and CBM formulas (0.65, 0.55, 0.003).</td></tr>
        <tr><td>Skip ASIN lines with 0 quantity</td><td>Removes zero-quantity ASINs (ticked by default).</td></tr></table>
    </section>

    <section class="gsec card" id="g-timer" data-t="Timer success failed status"><h2>⏱ The live timer</h2>
      <p>While generating, a timer shows the elapsed time, a progress ring and the current step (read source → match keys → build sheets → save).</p>
      <ul><li><b style="color:#34d399">Green ✓ Success</b> — shows total time and a summary (bookings, lines, pieces, Wrong CVC totals) with a <i>Download again</i> button.</li>
        <li><b style="color:#f87171">Red ✕ Failed</b> — shows the reason and how long it ran, with <i>Try again</i>.</li></ul>
    </section>

    <section class="gsec card" id="g-faq" data-t="Troubleshooting FAQ errors"><h2>🛡 Troubleshooting & FAQ</h2>
      <details><summary>“Missing sheet(s): BK / PurchaseOrderItems”</summary><p>The uploaded file does not have those sheet names. Use the SOURCE FILE exported for Century VMS (sheet names are not case-sensitive).</p></details>
      <details><summary>A BK key has no matching rows in PurchaseOrderItems</summary><p>The AI checks panel lists such PO-model-ECDD keys. They are skipped. Check that PO, model and ECDD are identical in both sheets.</p></details>
      <details><summary>BK qty ≠ PurchaseOrderItems qty</summary><p>A warning only — the output uses the PurchaseOrderItems quantities. Review the listed key in your source file.</p></details>
      <details><summary>The numbers look too small</summary><p>Your BK sheet probably has a filter on. Untick <b>Use BK sheet filter</b> to use all rows.</p></details>
      <details><summary>I see “No booking rows were produced”</summary><p>No ECDD date is selected, or the filter hides every row. Select at least one ECDD date or untick the BK filter.</p></details>
      <details><summary>WORKING DATE or totals are blank in a viewer</summary><p>Open the file in Excel — it recalculates on load. The file also stores the calculated values.</p></details>
      <details><summary>Where are my settings saved?</summary><p>In this browser (booking rule, column order, BK-filter choice and theme). Use the reset buttons in Settings to return to defaults.</p></details>
    </section>

    <section class="gsec card" id="g-tips" data-t="Tips shortcuts theme"><h2>✨ Tips</h2>
      <ul><li>☀/☾ button (top right) switches between the <b>dark</b> theme and the <b>white &amp; light-yellow</b> theme.</li>
        <li>Before every upload to Amazon, glance at the AI checks panel — warnings are listed there.</li>
        <li>The stat cards and the footer always describe exactly what will be written to the file.</li></ul>
    </section>
`;
