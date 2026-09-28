import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './componentes/Layout';
import { Carregando } from './componentes/ui';
import { useAuth } from './contexto/AuthContext';
import { DetalheTarefa } from './paginas/DetalheTarefa';
import { Entrar } from './paginas/Entrar';
import { FormGrupo } from './paginas/FormGrupo';
import { Historico } from './paginas/Historico';
import { MeusGrupos } from './paginas/MeusGrupos';
import { PainelGrupo } from './paginas/PainelGrupo';
import { Relatorio } from './paginas/Relatorio';

function Protegida() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: location.pathname }} />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar modo="login" />} />
      <Route path="/cadastro" element={<Entrar modo="cadastro" />} />
      <Route element={<Protegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<MeusGrupos />} />
          <Route path="/grupos/novo" element={<FormGrupo />} />
          <Route path="/grupos/:id" element={<PainelGrupo />} />
          <Route path="/grupos/:id/editar" element={<FormGrupo />} />
          <Route path="/grupos/:id/historico" element={<Historico />} />
          <Route path="/grupos/:id/relatorio" element={<Relatorio />} />
          <Route path="/tarefas/:id" element={<DetalheTarefa />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
