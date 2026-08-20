"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, HardHat, Waves } from "lucide-react";
import { Card, SkeletonCard, StatusBadge } from "@bba/ui";
import styles from "./project-overview.module.css";
import type { ProjectListItemDto } from "@/lib/bdos/project-executive-overview-server";

export function EngineeringWorkspaceObras() {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("empresa");
  const [projects, setProjects] = useState<ReadonlyArray<ProjectListItemDto> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = requestedOrganizationId ? `?empresa=${encodeURIComponent(requestedOrganizationId)}` : "";

    fetch(`/api/engenharia/obras${query}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Não foi possível carregar as obras.");
        return res.json();
      })
      .then((data) => {
        setProjects(data.projects ?? []);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setProjects([]);
        }
      });

    return () => controller.abort();
  }, [requestedOrganizationId]);

  const organizationQuery = requestedOrganizationId ? `?empresa=${encodeURIComponent(requestedOrganizationId)}` : "";

  if (projects === null) {
    return (
      <div className="span-12">
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return null;
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="span-12" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Obras em Execução
        </h3>
        <StatusBadge status="active">{`${projects.length} ${projects.length === 1 ? "obra ativa" : "obras ativas"}`}</StatusBadge>
      </div>

      <div className={styles.obrasListGrid}>
        {projects.map((project) => {
          const detailHref = `/workspaces/engenharia/obras/${encodeURIComponent(project.id)}${organizationQuery}`;
          return (
            <div className={styles.obraCard} key={project.id}>
              <div className={styles.obraCardHeader}>
                <div>
                  <div className={styles.obraCardTitle}>{project.name}</div>
                  {project.contractNumber && (
                    <div className={styles.obraCardContract}>Contrato nº {project.contractNumber}</div>
                  )}
                </div>
                <StatusBadge status="active">{project.statusLabel}</StatusBadge>
              </div>

              <div className={styles.obraCardBody}>
                {project.contractedValueFormatted && (
                  <div>
                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>
                      Valor Contratado
                    </div>
                    <div className={styles.obraCardValue}>{project.contractedValueFormatted}</div>
                  </div>
                )}

                {project.contractorName && (
                  <div className={styles.obraCardContractor}>
                    Contratado: <strong>{project.contractorName}</strong>
                  </div>
                )}
              </div>

              <div className={styles.obraCardFooter}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {project.totalItemsCount > 0 ? `${project.totalItemsCount} itens contratuais` : "Em acompanhamento"}
                </span>

                <Link className="bba-button bba-button--primary bba-button--sm" href={detailHref}>
                  Abrir Obra <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
