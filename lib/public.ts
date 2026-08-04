import type { Agency } from "@/lib/types";

/** Remove operational CRM fields before an agency record is sent to anonymous visitors. */
export function publicAgency(agency: Agency): Agency {
  return {
    ...agency,
    directors: null,
    owners: null,
    commercialManager: null,
    exchangeLead: null,
    notes: null,
    commercialPotential: "C",
    commercialStatus: undefined,
    assignedTo: null,
    opportunityScore: 0,
    estimatedValue: null,
    firstContactAt: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    lossReason: null,
    competitors: null,
    productsOfInterest: null,
    needs: null,
    contactCount: undefined,
  };
}

export function publicAgencyList(agencies: Agency[]) {
  return agencies.map(publicAgency);
}
