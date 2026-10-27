package f95

import (
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

func TestExtractCoverURLUsesAttachmentAttributes(t *testing.T) {
	body := parseImageBody(t, `<div class="bbWrapper">
		<img class="bbImage" src="https://attachments.f95zone.to/thumb/cover.jpg" data-url="https://attachments.f95zone.to/cover.jpg">
	</div>`)

	got := extractCoverURL(body)
	want := "https://attachments.f95zone.to/cover.jpg"
	if got != want {
		t.Fatalf("extractCoverURL() = %q; want %q", got, want)
	}
}

func TestExtractCoverURLFallsBackToLightboxHref(t *testing.T) {
	body := parseImageBody(t, `<div class="bbWrapper">
		<a class="lbContainer-zoomer" href="https://attachments.f95zone.to/thumb/cover.jpg"></a>
	</div>`)

	got := extractCoverURL(body)
	want := "https://attachments.f95zone.to/cover.jpg"
	if got != want {
		t.Fatalf("extractCoverURL() = %q; want %q", got, want)
	}
}

func TestExtractScreenshotsCollectsAndDeduplicatesAttachments(t *testing.T) {
	body := parseImageBody(t, `<div class="bbWrapper">
		<img class="bbImage" data-src="https://attachments.f95zone.to/cover.jpg">
		<img class="bbImage" src="https://attachments.f95zone.to/thumb/shot-one.jpg">
		<a class="lbContainer-zoomer" href="https://attachments.f95zone.to/thumb/shot-two.jpg"></a>
		<a class="lbContainer-zoomer" href="https://attachments.f95zone.to/shot-one.jpg"></a>
	</div>`)

	got := extractScreenshots(body, "https://attachments.f95zone.to/cover.jpg")
	want := []string{
		"https://attachments.f95zone.to/shot-one.jpg",
		"https://attachments.f95zone.to/shot-two.jpg",
	}
	if len(got) != len(want) {
		t.Fatalf("extractScreenshots() returned %d URLs; want %d: %v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("extractScreenshots()[%d] = %q; want %q", i, got[i], want[i])
		}
	}
}

func parseImageBody(t *testing.T, markup string) *goquery.Selection {
	t.Helper()
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(markup))
	if err != nil {
		t.Fatalf("parse image markup: %v", err)
	}
	return doc.Find(".bbWrapper")
}
