AUTH.handleCognitoCallback().catch(error => {
  document.getElementById("status").textContent = "Error en autenticación";
  document.getElementById("resultado").innerHTML = `
    <div class="alert alert-error mt-4">
      ${escapeHtml(error.message)}
    </div>
    <a href="login.html" class="btn btn-secondary mt-4">Volver al login</a>
  `;
});
