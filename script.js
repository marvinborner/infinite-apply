let fresh = 0; // every term has an id

const sidebar = document.querySelector(".sidebar");

/* lambda calculus */

const abs = (body) => {
  if (body === null) return null;
  return { type: "abs", body };
};

const app = (left) => (right) => {
  if (left === null || right === null) return null;
  return { type: "app", left, right };
};

const idx = (idx) => {
  if (idx === null) return null;
  return { type: "idx", idx };
};

const namedAbs = (name, body) => {
  if (body === null) return null;
  return { type: "named-abs", name, body };
};

const higherOrderAbs = (f) => {
  if (f === null) return null;
  return { type: "higher-order-abs", f: f };
};

const higherOrderApp = (a) => {
  if (a === null) return () => null;
  else if (a.type == "higher-order-abs") return a.f;
  else return app(a);
};

let MAX = 0;
let depth = 0;
let canceled = false;
const cancelReduction = () => {
  if (depth++ > MAX && !canceled) {
    MAX **= 1.5;
    if (
      !confirm(
        `This takes awfully long (${depth} steps!). The reduction potentially won't converge. Do you want to continue?\nWarning: This might crash your browser!`,
      )
    ) {
      canceled = true;
      return true;
    }
  }
  return canceled;
};

const toTerm = () => {
  depth = 0;
  const go = (env) => (t) => {
    if (cancelReduction()) return null;
    if (t === null) return null;
    switch (t.type) {
      case "app":
        return app(go(env)(t.left))(go(env)(t.right));
      case "named-abs":
        return abs(go([t.name, ...env])(t.body));
      case "idx":
        return idx(t.idx in env ? env[t.idx] : t.idx);
      default:
        alert("fatal error");
        return null;
    }
  };
  return go([]);
};

const toNamedTerm = () => {
  depth = 0;
  const go = (d) => (t) => {
    if (cancelReduction()) return null;
    if (t === null) return null;
    switch (t.type) {
      case "app":
        return app(go(d)(t.left))(go(d)(t.right));
      case "higher-order-abs":
        return namedAbs(d, go(d + 1)(t.f(idx(d))));
      case "idx":
        return idx(t.idx);
      default:
        alert("fatal error");
        return null;
    }
  };
  return go(0);
};

const toHigherOrder = () => {
  depth = 0;
  const go = (env) => (t) => {
    if (cancelReduction()) return null;
    if (t === null) return null;
    switch (t.type) {
      case "app":
        return higherOrderApp(go(env)(t.left))(go(env)(t.right));
      case "abs":
        return higherOrderAbs((x) => go([x, ...env])(t.body));
      case "idx":
        if (t.idx in env) return env[t.idx];
        else return idx(t.idx);
      default:
        alert("fatal error");
        return null;
    }
  };
  return go([]);
};

const reduce = (t) => {
  MAX = 16384;
  canceled = false;
  try {
    return toTerm()(toNamedTerm()(toHigherOrder()(t)));
  } catch (e) {
    console.error(e);
    alert(e);
    return null;
  }
};

const show = (term) => {
  if (term === null) return "";
  switch (term.type) {
    case "abs":
      return `λ${show(term.body)}`;
    case "app":
      return `(${show(term.left)} ${show(term.right)})`;
    case "idx":
      return `${term.idx}`;
  }
};

const parse = (str) => {
  if (!str) return [{}, ""];
  const head = str[0];
  const tail = str.slice(1);
  switch (head) {
    case "λ":
      const [body, _tail] = parse(tail);
      return [abs(body), _tail];
    case "(":
      const [left, tail1] = parse(tail);
      const [right, tail2] = parse(tail1.slice(1));
      return [app(left)(right), tail2.slice(1)];
    case ")":
      alert("fatal");
      return [];
    default:
      let num = "";
      while (str && str[0] >= "0" && str[0] <= "9") {
        num += str[0];
        str = str.slice(1);
      }
      return [idx(parseInt(num)), str];
  }
};

/* box dragging */

const toBox = (name, term) => {
  return `<div data-id=${fresh++} class="box" draggable="true" data-term="${term}">${name}</div>`;
};

let offset = { x: 0, y: 0 };
const main = document.querySelector(".main");

const addDrag = (box) => {
  box.addEventListener("dragstart", (e) => {
    const from = box.parentElement.classList[0];
    e.dataTransfer.setData("text/plain", box.getAttribute("data-id"));
    offset.x = e.clientX - box.getBoundingClientRect().left;
    offset.y = e.clientY - box.getBoundingClientRect().top;
  });
  box.addEventListener("click", () => {
    box.toggleAttribute("clicked");
  });
  box.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const name = prompt("Name this term:", box.getAttribute("data-term"));
    if (!name) return;
    const term = box.getAttribute("data-term");
    document.querySelectorAll(".box").forEach((box) => {
      if (box.getAttribute("data-term") == term) box.innerText = name;
    });
    delete inventory[term];
    discover(name, parse(term)[0]);
  });
};

const merge = (box) => {
  main.querySelectorAll(".box").forEach((other) => {
    if (box === other) return;
    const boxRect = box.getBoundingClientRect();
    const otherRect = other.getBoundingClientRect();
    if (
      boxRect.left < otherRect.right &&
      boxRect.right > otherRect.left &&
      boxRect.top < otherRect.bottom &&
      boxRect.bottom > otherRect.top
    ) {
      const term1 = box.getAttribute("data-term");
      const term2 = other.getAttribute("data-term");
      box.remove();
      const nf = reduce(parse(`(${term2} ${term1})`)[0], 0);
      if (nf) {
        const str = show(nf);
        const name = str in inventory ? inventory[str] : str;
        other.setAttribute("data-term", str);
        other.innerText = name;
        if (discover(name, nf)) other.classList.add("discovered");
      }
    }
  });
};

main.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
});

main.addEventListener("drop", (e) => {
  e.preventDefault();
  const id = e.dataTransfer.getData("text/plain");
  const from = document.querySelector(`[data-id="${id}"]`);
  const box = document.createElement("div");
  box.classList.add("box");
  box.setAttribute("data-id", fresh++);
  box.setAttribute("draggable", "true");
  box.setAttribute("data-term", from.getAttribute("data-term"));
  box.innerText = from.innerText;
  addDrag(box);

  if (from.parentElement.classList[0] === "main") from.remove();

  const x = e.clientX - offset.x;
  const y = e.clientY - offset.y;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.position = "absolute";
  main.appendChild(box);
  merge(box);
});

/* inventory */

const inventory = {};
const discover = (name, term) => {
  const str = show(term);
  if (str in inventory) return false;
  inventory[str] = name;
  sidebar.querySelector(".inventory").innerHTML = Object.keys(inventory)
    .map((term) => toBox(inventory[term], term))
    .join("");
  sidebar.querySelectorAll(".inventory .box").forEach(addDrag);
  localStorage.setItem("inventory", JSON.stringify(inventory));
  return true;
};

const load = () => {
  const inv = JSON.parse(localStorage.getItem("inventory"));
  if (inv) {
    Object.keys(inv).forEach((name) => {
      discover(inv[name], parse(name)[0]);
    });
  }
};

load();

const s = abs(abs(abs(app(app(idx(2))(idx(0)))(app(idx(1))(idx(0))))));
const k = abs(abs(idx(1)));
discover("s", s);
discover("k", k);

/* search */

sidebar.querySelector("input").addEventListener("keyup", (e) => {
  const query = e.target.value;
  const queryLambda = query.replaceAll("\\", "λ");
  sidebar.querySelectorAll(".inventory .box").forEach((box) => {
    if (
      query == "" ||
      box.getAttribute("data-term").includes(query) ||
      box.innerText.includes(queryLambda)
    ) {
      box.style.display = "block";
    } else {
      box.style.display = "none";
    }
  });
});

/* popups */

const popup = document.querySelector(".popup");

const message = (str) => {
  window.popupText.innerHTML = str;
  window.popupClose.style.display = "block";
  popup.classList.add("active");
};

/* buttons */

window.clean.addEventListener("click", () => {
  document
    .querySelector(".main")
    .querySelectorAll(".box")
    .forEach((box) => {
      box.remove();
    });
});

window.popupClose.addEventListener("click", () => {
  popup.classList.remove("active");
});

window.help.addEventListener("click", () => {
  message(
    "Every box on the side panel is a term of pure lambda calculus with <a href='https://en.wikipedia.org/wiki/De_Bruijn_index' target=_blank>de Bruijn indices</a>. By dragging boxes into the left canvas you can apply them to each other. Two colliding boxes beta-reduce and form a new term. The dropped term is always on the right side of the application.<br><br>Once you have a new term, you can merge it with others or right-click/press-hold the box to give the term a name.<br><br>You start with the combinators S and K. If correctly combined, they can generate any term of lambda calculus. Since lambda calculus is Turing complete, you can theoretically execute any computation just by using drag'n'drop!<br><br>As a challenge, try to find the Church numeral zero as well as its addition and multiplication functions. Applying two Church numerals will result in exponentiation!<br><br>Have fun!<br>If you enjoy this, you might also like <a href='https://bruijn.marvinborner.de' target=_blank>bruijn</a>.<br><br>Credits: Idea from neal.fun, logos from feathericons.",
  );
});

window.github.addEventListener("click", () => {
  window.open("https://github.com/marvinborner/infinite-apply", "_blank");
});

window.support.addEventListener("click", () => {
  window.open("https://ko-fi.com/marvinborner", "_blank");
});

window.restart.addEventListener("click", () => {
  if (
    !confirm(
      "Are you sure you want to restart? You will lose your entire inventory.",
    )
  )
    return;
  localStorage.clear();
  window.location.reload();
});
