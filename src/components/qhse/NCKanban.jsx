import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

const COLUMNS = [
  { id: "Ouverte", label: "Ouverte", color: "bg-slate-100 border-slate-200", dot: "bg-slate-400" },
  { id: "En investigation", label: "Investigation", color: "bg-blue-50 border-blue-200", dot: "bg-blue-400" },
  { id: "En cours de traitement", label: "Traitement", color: "bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  { id: "En vérification d'efficacité", label: "Vérification", color: "bg-violet-50 border-violet-200", dot: "bg-violet-400" },
  { id: "Clôturée", label: "Clôturée", color: "bg-green-50 border-green-200", dot: "bg-green-400" },
];

// Transitions autorisées (statut source → statuts cibles)
const ALLOWED_TRANSITIONS = {
  "Ouverte": ["En investigation"],
  "En investigation": ["Ouverte", "En cours de traitement"],
  "En cours de traitement": ["En investigation", "En vérification d'efficacité"],
  "En vérification d'efficacité": ["En cours de traitement", "Clôturée"],
  "Clôturée": [],
};

export default function NCKanban({ ncs, isQHSE }) {
  const queryClient = useQueryClient();

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = ncs.filter(nc =>
      col.id === "En cours de traitement"
        ? nc.statut === "En cours de traitement" || nc.statut === "En retard"
        : nc.statut === col.id
    );
    return acc;
  }, {});

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;
    if (!isQHSE) return;

    const newStatut = destination.droppableId;
    const nc = ncs.find(n => n.id === draggableId);
    if (!nc) return;

    const allowed = ALLOWED_TRANSITIONS[nc.statut] || [];
    if (!allowed.includes(newStatut)) return;

    await base44.entities.NonConformite.update(draggableId, { statut: newStatut });
    queryClient.invalidateQueries({ queryKey: ["ncs-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["mes-ncs"] });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const cards = grouped[col.id] || [];
          return (
            <div key={col.id} className="flex-shrink-0 w-64">
              {/* En-tête colonne */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border border-b-0 ${col.color}`}>
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                <span className="ml-auto text-xs text-slate-400 font-medium">{cards.length}</span>
              </div>

              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-48 p-2 rounded-b-xl border border-t-0 space-y-2 transition-colors ${col.color} ${snapshot.isDraggingOver ? "ring-2 ring-blue-400 ring-inset" : ""}`}
                  >
                    {cards.map((nc, index) => (
                      <Draggable key={nc.id} draggableId={nc.id} index={index} isDragDisabled={!isQHSE}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-lg border border-slate-100 p-3 shadow-sm transition-shadow ${snapshot.isDragging ? "shadow-lg rotate-1" : "hover:shadow-md"} ${isQHSE ? "cursor-grab active:cursor-grabbing" : ""}`}
                          >
                            <Link to={`/NCDetail?id=${nc.id}`} onClick={e => snapshot.isDragging && e.preventDefault()}>
                              <p className="text-xs font-bold text-blue-700">{nc.numero}</p>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{nc.ecartConstate || nc.titre}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-slate-400">{nc.departement}</span>
                                {nc.created_date && (
                                  <span className="text-xs text-slate-400">{format(new Date(nc.created_date), "dd/MM")}</span>
                                )}
                              </div>
                            </Link>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {cards.length === 0 && (
                      <p className="text-xs text-slate-300 text-center py-6">Aucune NC</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}