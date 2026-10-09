<template>

  <section>

    <div class="grid-metricas">

      <div class="metrica-card">
        <span>Total requerimientos</span>
        <strong>—</strong>
        <small>Vista consolidada</small>
      </div>

      <div class="metrica-card">
        <span>Demanda Táctica</span>
        <strong>—</strong>
        <small>Fuente DT</small>
      </div>

      <div class="metrica-card">
        <span>ClearQuest</span>
        <strong>—</strong>
        <small>Fuente CQ</small>
      </div>

      <div class="metrica-card">
        <span>Fábrica</span>
        <strong>—</strong>
        <small>Desarrollo externo</small>
      </div>

    </div>


    <div class="dashboard-grid">

      <div class="panel">

        <h3>
          Requerimientos por estado
        </h3>

        <div class="placeholder">
          Gráfico pendiente
        </div>

      </div>


      <div class="panel">

        <h3>
          Carga por analista
        </h3>

        <div class="placeholder">
          Gráfico pendiente
        </div>

      </div>

    </div>

  </section>

</template>


<style scoped>

.grid-metricas {
  display: grid;

  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );

  gap: 14px;

  margin-bottom: 18px;
}


.metrica-card,
.panel {
  background: white;

  border:
      1px solid #e2e8f0;

  border-radius: 12px;
}


.metrica-card {
  padding: 18px;
}


.metrica-card span {
  color: #64748b;

  font-size: 12px;
}


.metrica-card strong {
  display: block;

  margin-top: 8px;

  color: #0f172a;

  font-size: 28px;
}


.metrica-card small {
  display: block;

  margin-top: 7px;

  color: #94a3b8;
}


.dashboard-grid {
  display: grid;

  grid-template-columns:
    1fr 1fr;

  gap: 18px;
}


.panel {
  padding: 20px;
}


.panel h3 {
  margin: 0;

  color: #334155;

  font-size: 14px;
}


.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 260px;
  margin-top: 15px;
  border-radius: 8px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 12px;
}

@media (
max-width: 1000px
) {
  .grid-metricas {
    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );
  }

  .dashboard-grid {
    grid-template-columns:
      1fr;
  }
}

</style>