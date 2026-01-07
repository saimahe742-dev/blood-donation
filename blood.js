let donors = [];

const previousDonationSelect = document.getElementById("previousDonation");
const previousDateGroup = document.getElementById("previousDateGroup");

previousDonationSelect.addEventListener("change", () => {
  previousDateGroup.style.display =
    previousDonationSelect.value === "yes" ? "block" : "none";
});

// Register donor
document.getElementById("donorForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const donor = {
    name: document.getElementById("name").value,
    bloodType: document.getElementById("bloodType").value,
    district: document.getElementById("district").value,
    contact: document.getElementById("contact").value,
    lastDonation: document.getElementById("previousDonationDate").value || null,
  };

  donor.nextEligible = calculateNextEligible(donor.lastDonation);
  donors.push(donor);

  alert("Donor Registered Successfully!");
  this.reset();
  previousDateGroup.style.display = "none";
});

// Calculate 9 weeks cooldown
function calculateNextEligible(date) {
  if (!date) return new Date();
  const d = new Date(date);
  d.setDate(d.getDate() + 63);
  return d;
}

// Search donor
function searchDonor() {
  const district = document.getElementById("searchDistrict").value;
  const bloodType = document.getElementById("searchBloodType").value;
  const donorList = document.getElementById("donorList");

  donorList.innerHTML = "<h2>Matching Donors</h2>";

  const today = new Date();

  const results = donors.filter(
    d => d.district === district && d.bloodType === bloodType
  );

  if (results.length === 0) {
    donorList.innerHTML += "<p>No donors found.</p>";
    return;
  }

  results.forEach(donor => {
    const eligible = today >= donor.nextEligible;

    donorList.innerHTML += `
      <div class="donor ${eligible ? "" : "inactive"}">
        <p><b>${donor.name}</b> (${donor.bloodType})</p>
        <p>District: ${donor.district}</p>
        <p>Contact: ${donor.contact}</p>
        <p>Status: ${eligible ? "🟢 Eligible" : "🔴 Not Eligible"}</p>
      </div>
    `;
  });
}
