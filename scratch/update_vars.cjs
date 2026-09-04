const fs = require("fs");
["the_seed/templates", "the_seed/08_PRODUCTION_TEMPLATES"].forEach(dir => {
  ["01_ui_kit_components.toad", "02_saas_metrics_dashboard.toad", "03_event_tent_card_multiside.toad", "04_marketing_hero_poster.toad"].forEach(file => {
    const p = dir + "/" + file;
    if (fs.existsSync(p)) {
      let content = fs.readFileSync(p, "utf8");
      // Replace variable references and declarations: $varName -> >varName
      // But avoid price strings like "$14.24M"
      content = content.replace(/\$([a-zA-Z_][a-zA-Z0-9_-]*)/g, ">$1");
      fs.writeFileSync(p, content, "utf8");
      console.log("Updated", p);
    }
  });
});
