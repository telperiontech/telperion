// Package declare applies frp-gate's declarative config file: zones, frps
// instances, groups, clients and grants kept in git (FRP_GATE_CONFIG,
// `frp-gate apply`), and exports the database in the same format.
//
// Objects declared in the file are "managed": apply creates, updates and
// deletes them; the admin UI and API do not edit or delete them. Objects
// made in the UI are never touched by apply.
package declare

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"

	"go.yaml.in/yaml/v3"
)

// File is the YAML document.
//
//	zones: [example.org]
//	instances:
//	  default: { server_addr: gate.example.org:7000, zones: [example.org] }
//	groups: [webapp]
//	clients:
//	  home-pi: { note: Pi frpc, token_env: FRP_GATE_TOKEN_HOME_PI, groups: [] }
//	grants:
//	  - { client: home-pi, kind: host, zone: example.org, pattern: "*" }
type File struct {
	Zones     []string                `yaml:"zones,omitempty"`
	Instances map[string]InstanceSpec `yaml:"instances,omitempty"`
	Groups    []string                `yaml:"groups,omitempty"`
	Clients   map[string]ClientSpec   `yaml:"clients,omitempty"`
	Grants    []GrantSpec             `yaml:"grants,omitempty"`
}

// InstanceSpec is an frps that uses frp-gate as its plugin. Its plugin key
// comes from at most one of KeyEnv, KeyFile and KeySHA256; without one, an
// existing instance keeps its key (e.g. from FRP_GATE_INSTANCE_KEY).
type InstanceSpec struct {
	ServerAddr string   `yaml:"server_addr,omitempty"`
	Zones      []string `yaml:"zones,omitempty"`
	KeyEnv     string   `yaml:"key_env,omitempty"`
	KeyFile    string   `yaml:"key_file,omitempty"`
	KeySHA256  string   `yaml:"key_sha256,omitempty"`
}

// ClientSpec is a token holder. Its token comes from at most one of
// TokenEnv, TokenFile and TokenSHA256; without one, an existing client keeps
// its token and a new one gets a random token that is never shown (rotate
// it in the UI). Disabled is only applied when set.
type ClientSpec struct {
	Note        string   `yaml:"note,omitempty"`
	Groups      []string `yaml:"groups,omitempty"`
	Disabled    *bool    `yaml:"disabled,omitempty"`
	TokenEnv    string   `yaml:"token_env,omitempty"`
	TokenFile   string   `yaml:"token_file,omitempty"`
	TokenSHA256 string   `yaml:"token_sha256,omitempty"`
}

// GrantSpec is one grant for a client or a group.
// host: Zone + Pattern (relative to the zone, "@" for the zone itself).
// port: Instance + Proto + Ports ("25565" or "6000-6010").
type GrantSpec struct {
	Client   string `yaml:"client,omitempty"`
	Group    string `yaml:"group,omitempty"`
	Kind     string `yaml:"kind"`
	Zone     string `yaml:"zone,omitempty"`
	Pattern  string `yaml:"pattern,omitempty"`
	Instance string `yaml:"instance,omitempty"`
	Proto    string `yaml:"proto,omitempty"`
	Ports    Ports  `yaml:"ports,omitempty"`
}

// Ports accepts `ports: 25565` as well as `ports: "6000-6010"`.
type Ports string

// UnmarshalYAML takes any scalar as text.
func (p *Ports) UnmarshalYAML(n *yaml.Node) error {
	if n.Kind != yaml.ScalarNode {
		return fmt.Errorf("line %d: ports must be a port or a range like \"6000-6010\"", n.Line)
	}
	*p = Ports(n.Value)
	return nil
}

// ParseFile reads and parses a config file.
func ParseFile(path string) (*File, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	f, err := Parse(bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return f, nil
}

// Parse reads one YAML document. Unknown keys are errors, and so is an
// empty document: applying it would delete every managed object, which is
// almost certainly a mistake (a truncated or wrongly mounted file).
func Parse(r io.Reader) (*File, error) {
	dec := yaml.NewDecoder(r)
	dec.KnownFields(true)
	var f File
	if err := dec.Decode(&f); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, errors.New("the config file is empty")
		}
		return nil, err
	}
	if len(f.Zones) == 0 && len(f.Instances) == 0 && len(f.Groups) == 0 && len(f.Clients) == 0 && len(f.Grants) == 0 {
		return nil, errors.New("the config file declares nothing; to remove every managed object, delete them one by one or use a file with at least one object")
	}
	var extra yaml.Node
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return nil, errors.New("the config file must hold a single YAML document")
	}
	return &f, nil
}

// Encode writes the file as YAML.
func (f *File) Encode(w io.Writer) error {
	enc := yaml.NewEncoder(w)
	enc.SetIndent(2)
	if err := enc.Encode(f); err != nil {
		return err
	}
	return enc.Close()
}
