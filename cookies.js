// Banner de cookies minimo (CSP-safe: archivo externo, sin inline).
// Solo recuerda la aceptacion en localStorage. Sin rastreo propio.
(function () {
  try {
    if (localStorage.getItem("ck") === "1") return;
    var b = document.createElement("div");
    b.id = "ckbar";
    b.innerHTML = '<span>Usamos cookies basicas y, pronto, de Google (anuncios y estadisticas). <a href="privacy.html">Privacidad</a></span><button id="ckok" type="button">Aceptar</button>';
    document.body.appendChild(b);
    document.getElementById("ckok").onclick = function () {
      try { localStorage.setItem("ck", "1"); } catch (e) {}
      b.remove();
    };
  } catch (e) {}
})();
